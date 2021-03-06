define(['riot'], function (riot) { 'use strict';

  riot = riot && riot.hasOwnProperty('default') ? riot['default'] : riot;

  var observable = function(el) {

    /**
     * Extend the original object or create a new empty one
     * @type { Object }
     */

    el = el || {};

    /**
     * Private variables
     */
    var callbacks = {},
      slice = Array.prototype.slice;

    /**
     * Public Api
     */

    // extend the el object adding the observable methods
    Object.defineProperties(el, {
      /**
       * Listen to the given `event` ands
       * execute the `callback` each time an event is triggered.
       * @param  { String } event - event id
       * @param  { Function } fn - callback function
       * @returns { Object } el
       */
      on: {
        value: function(event, fn) {
          if (typeof fn == 'function')
            { (callbacks[event] = callbacks[event] || []).push(fn); }
          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Removes the given `event` listeners
       * @param   { String } event - event id
       * @param   { Function } fn - callback function
       * @returns { Object } el
       */
      off: {
        value: function(event, fn) {
          if (event == '*' && !fn) { callbacks = {}; }
          else {
            if (fn) {
              var arr = callbacks[event];
              for (var i = 0, cb; cb = arr && arr[i]; ++i) {
                if (cb == fn) { arr.splice(i--, 1); }
              }
            } else { delete callbacks[event]; }
          }
          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Listen to the given `event` and
       * execute the `callback` at most once
       * @param   { String } event - event id
       * @param   { Function } fn - callback function
       * @returns { Object } el
       */
      one: {
        value: function(event, fn) {
          function on() {
            el.off(event, on);
            fn.apply(el, arguments);
          }
          return el.on(event, on)
        },
        enumerable: false,
        writable: false,
        configurable: false
      },

      /**
       * Execute all callback functions that listen to
       * the given `event`
       * @param   { String } event - event id
       * @returns { Object } el
       */
      trigger: {
        value: function(event) {
          var arguments$1 = arguments;


          // getting the arguments
          var arglen = arguments.length - 1,
            args = new Array(arglen),
            fns,
            fn,
            i;

          for (i = 0; i < arglen; i++) {
            args[i] = arguments$1[i + 1]; // skip first argument
          }

          fns = slice.call(callbacks[event] || [], 0);

          for (i = 0; fn = fns[i]; ++i) {
            fn.apply(el, args);
          }

          if (callbacks['*'] && event != '*')
            { el.trigger.apply(el, ['*', event].concat(args)); }

          return el
        },
        enumerable: false,
        writable: false,
        configurable: false
      }
    });

    return el

  };

  var RE_ORIGIN = /^.+?\/\/+[^/]+/,
    EVENT_LISTENER = 'EventListener',
    REMOVE_EVENT_LISTENER = 'remove' + EVENT_LISTENER,
    ADD_EVENT_LISTENER = 'add' + EVENT_LISTENER,
    HAS_ATTRIBUTE = 'hasAttribute',
    POPSTATE = 'popstate',
    HASHCHANGE = 'hashchange',
    TRIGGER = 'trigger',
    MAX_EMIT_STACK_LEVEL = 3,
    win = typeof window != 'undefined' && window,
    doc = typeof document != 'undefined' && document,
    hist = win && history,
    loc = win && (hist.location || win.location), // see html5-history-api
    prot = Router.prototype, // to minify more
    clickEvent = doc && doc.ontouchstart ? 'touchstart' : 'click',
    central = observable();

  var
    started = false,
    routeFound = false,
    debouncedEmit,
    base,
    current,
    parser,
    secondParser,
    emitStack = [],
    emitStackLevel = 0;

  /**
   * Default parser. You can replace it via router.parser method.
   * @param {string} path - current path (normalized)
   * @returns {array} array
   */
  function DEFAULT_PARSER(path) {
    return path.split(/[/?#]/)
  }

  /**
   * Default parser (second). You can replace it via router.parser method.
   * @param {string} path - current path (normalized)
   * @param {string} filter - filter string (normalized)
   * @returns {array} array
   */
  function DEFAULT_SECOND_PARSER(path, filter) {
    var names = filter.match(/\/:(\w+)/g);
    var f = filter
      .replace(/\?/g, '\\?')
      .replace(/\*/g, '([^/?#]+?)')
      .replace(/\.\./, '.*')
      .replace(/\/:\w+/g, '(\\/[a-zA-Z0-9_\\-\\+=:\\(\\)\\[\\]\\\s+]+|)');
    var re = new RegExp('^' + f + '$');
    var args = path.match(re);
    if (args) {
      if (names) {
        var result = {};
        for (var i = 0; i < names.length; i++) {
          var string = args[i + 1];
          if (string.length > 0) {
            result[names[i].substring(2)] = args[i + 1].substring(1);
          }
        }

        return result;
      }

      return args.slice(1)
    }
  }

  /**
   * Simple/cheap debounce implementation
   * @param   {function} fn - callback
   * @param   {number} delay - delay in seconds
   * @returns {function} debounced function
   */
  function debounce(fn, delay) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, delay);
    }
  }

  /**
   * Set the window listeners to trigger the routes
   * @param {boolean} autoExec - see route.start
   */
  function start(autoExec) {
    debouncedEmit = debounce(emit, 1);
    win[ADD_EVENT_LISTENER](POPSTATE, debouncedEmit);
    win[ADD_EVENT_LISTENER](HASHCHANGE, debouncedEmit);
    doc[ADD_EVENT_LISTENER](clickEvent, click);
    if (autoExec) { emit(true); }
  }

  /**
   * Router class
   */
  function Router() {
    this.$ = [];
    observable(this); // make it observable
    central.on('stop', this.s.bind(this));
    central.on('emit', this.e.bind(this));
  }

  function normalize(path) {
    return path.replace(/^\/|\/$/, '')
  }

  function isString(str) {
    return typeof str == 'string'
  }

  /**
   * Get the part after domain name
   * @param {string} href - fullpath
   * @returns {string} path from root
   */
  function getPathFromRoot(href) {
    return (href || loc.href).replace(RE_ORIGIN, '')
  }

  /**
   * Get the part after base
   * @param {string} href - fullpath
   * @returns {string} path from base
   */
  function getPathFromBase(href) {
    return base[0] === '#'
      ? (href || loc.href || '').split(base)[1] || ''
      : (loc ? getPathFromRoot(href) : href || '').replace(base, '')
  }

  function emit(force) {
    // the stack is needed for redirections
    var isRoot = emitStackLevel === 0;
    if (MAX_EMIT_STACK_LEVEL <= emitStackLevel) { return }

    emitStackLevel++;
    emitStack.push(function() {
      var path = getPathFromBase();
      if (force || path !== current) {
        central[TRIGGER]('emit', path);
        current = path;
      }
    });
    if (isRoot) {
      var first;
      while (first = emitStack.shift()) { first(); } // stack increses within this call
      emitStackLevel = 0;
    }
  }

  function click(e) {
    if (
      e.which !== 1 // not left click
      || e.metaKey || e.ctrlKey || e.shiftKey // or meta keys
      || e.defaultPrevented // or default prevented
    ) { return }

    var el = e.target;
    while (el && el.nodeName !== 'A') { el = el.parentNode; }

    if (
      !el || el.nodeName !== 'A' // not A tag
      || el[HAS_ATTRIBUTE]('download') // has download attr
      || !el[HAS_ATTRIBUTE]('href') // has no href attr
      || el.target && el.target !== '_self' // another window or frame
      || el.href.indexOf(loc.href.match(RE_ORIGIN)[0]) === -1 // cross origin
    ) { return }

    if (el.href !== loc.href
      && (
        el.href.split('#')[0] === loc.href.split('#')[0] // internal jump
        || base[0] !== '#' && getPathFromRoot(el.href).indexOf(base) !== 0 // outside of base
        || base[0] === '#' && el.href.split(base)[0] !== loc.href.split(base)[0] // outside of #base
        || !go(getPathFromBase(el.href), el.title || doc.title) // route not found
      )) { return }

    e.preventDefault();
  }

  /**
   * Go to the path
   * @param {string} path - destination path
   * @param {string} title - page title
   * @param {boolean} shouldReplace - use replaceState or pushState
   * @returns {boolean} - route not found flag
   */
  function go(path, title, shouldReplace) {
    // Server-side usage: directly execute handlers for the path
    if (!hist) { return central[TRIGGER]('emit', getPathFromBase(path)) }

    path = base + normalize(path);
    title = title || doc.title;
    // browsers ignores the second parameter `title`
    shouldReplace
      ? hist.replaceState(null, title, path)
      : hist.pushState(null, title, path);
    // so we need to set it manually
    doc.title = title;
    routeFound = false;
    emit();
    return routeFound
  }

  /**
   * Go to path or set action
   * a single string:                go there
   * two strings:                    go there with setting a title
   * two strings and boolean:        replace history with setting a title
   * a single function:              set an action on the default route
   * a string/RegExp and a function: set an action on the route
   * @param {(string|function)} first - path / action / filter
   * @param {(string|RegExp|function)} second - title / action
   * @param {boolean} third - replace flag
   */
  prot.m = function(first, second, third) {
    if (isString(first) && (!second || isString(second))) { go(first, second, third || false); }
    else if (second) { this.r(first, second); }
    else { this.r('@', first); }
  };

  /**
   * Stop routing
   */
  prot.s = function() {
    this.off('*');
    this.$ = [];
  };

  /**
   * Emit
   * @param {string} path - path
   */
  prot.e = function(path) {
    this.$.concat('@').some(function(filter) {
      var args = (filter === '@' ? parser : secondParser)(normalize(path), normalize(filter));
      if (typeof args != 'undefined') {
        this[TRIGGER].apply(null, [filter].concat(args));
        return routeFound = true // exit from loop
      }
    }, this);
  };

  /**
   * Register route
   * @param {string} filter - filter for matching to url
   * @param {function} action - action to register
   */
  prot.r = function(filter, action) {
    if (filter !== '@') {
      filter = '/' + normalize(filter);
      this.$.push(filter);
    }
    this.on(filter, action);
  };

  var mainRouter = new Router();
  var route = mainRouter.m.bind(mainRouter);

  /**
   * Create a sub router
   * @returns {function} the method of a new Router object
   */
  route.create = function() {
    var newSubRouter = new Router();
    // assign sub-router's main method
    var router = newSubRouter.m.bind(newSubRouter);
    // stop only this sub-router
    router.stop = newSubRouter.s.bind(newSubRouter);
    return router
  };

  /**
   * Set the base of url
   * @param {(str|RegExp)} arg - a new base or '#' or '#!'
   */
  route.base = function(arg) {
    base = arg || '#';
    current = getPathFromBase(); // recalculate current path
  };

  /** Exec routing right now **/
  route.exec = function() {
    emit(true);
  };

  /**
   * Replace the default router to yours
   * @param {function} fn - your parser function
   * @param {function} fn2 - your secondParser function
   */
  route.parser = function(fn, fn2) {
    if (!fn && !fn2) {
      // reset parser for testing...
      parser = DEFAULT_PARSER;
      secondParser = DEFAULT_SECOND_PARSER;
    }
    if (fn) { parser = fn; }
    if (fn2) { secondParser = fn2; }
  };

  /**
   * Helper function to get url query as an object
   * @returns {object} parsed query
   */
  route.query = function() {
    var q = {};
    var href = loc.href || current;
    href.replace(/[?&](.+?)=([^&]*)/g, function(_, k, v) { q[k] = v; });
    return q
  };

  /** Stop routing **/
  route.stop = function () {
    if (started) {
      if (win) {
        win[REMOVE_EVENT_LISTENER](POPSTATE, debouncedEmit);
        win[REMOVE_EVENT_LISTENER](HASHCHANGE, debouncedEmit);
        doc[REMOVE_EVENT_LISTENER](clickEvent, click);
      }
      central[TRIGGER]('stop');
      started = false;
    }
  };

  /**
   * Start routing
   * @param {boolean} autoExec - automatically exec after starting if true
   */
  route.start = function (autoExec) {
    if (!started) {
      if (win) {
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
          start(autoExec);
        }
        else {
          document.onreadystatechange = function () {
            if (document.readyState === 'interactive') {
              // the timeout is needed to solve
              // a weird safari bug https://github.com/riot/route/issues/33
              setTimeout(function() { start(autoExec); }, 1);
            }
          };
        }
      }
      started = true;
    }
  };

  /** Prepare the router **/
  route.base();
  route.parser();

  riot.tag2('router', '<yield></yield>', '', '', function(opts) {
      var this$1 = this;


      this.route = route.create();
      this.select = function (target) {
        if (target.show) {

          this$1.parent.update();

          this$1.trigger("change", target);

          return;
        }

        this$1.tags.route.forEach(function (r) {
          r.show = false;
        });

        this$1.parent.update();

        target.show = true;

        this$1.parent.update();

        this$1.trigger("change", target);
      };

      this.on('mount', function () {

        window.setTimeout(function () { return route.start(true); }, 0);
      });

      this.on('unmount', function () {
        this$1.route.stop();
      });
  });

  riot.tag2('route', '<virtual if="{show}"><yield></yield></virtual>', '', '', function(opts) {
      var arguments$1 = arguments;
      var this$1 = this;

      if (this.parent && this.parent.parent) {
        var object = riot.util.misc.extend(Object.create(this), this.parent.parent);
        for(var key in object) {
          if (!isNaN(key)) {
            delete object[key];
          } else if (key.startsWith("_")) {
            object[key.substring(1)] = object[key];
            delete object[key];
          }
        }

        riot.util.misc.extend(this, object);
      }

      this.show = false;

      this.parent.route(opts.path, function () {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        if (this$1.parent.opts.interceptor) {
          this$1.parent.opts.interceptor(this$1.opts).then(function (status) {
            if (status) {
              this$1.complete(args);
            }
          });
        } else {
          this$1.complete(args);
        }
      });

      this.complete = function (pathArgs) {
          if (pathArgs.length == 1) {
            args = pathArgs[0];
          } else {
            var args = [], len = pathArgs.length;
            while (len--) { args[len] = arguments$1[len]; }
          }

          this$1.on('updated', function () {
            var tags = flatten(this$1.tags);
            if (tags.length > 0) {
              this$1.off("updated");

              tags.forEach(function (tag) {
                tag.trigger.apply(tag, [ 'route' ].concat( args ));
              });
            }
          });

          this$1.parent.select(this$1);
      };

      function flatten(tags) {
        return Object.keys(tags)
          .map(function (key) { return tags[key]; })
          .reduce(function (acc, tag) { return acc.concat(tag); }, [])
      }
  });

  return route;

});
