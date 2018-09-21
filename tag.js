'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var riot = _interopDefault(require('riot'));
var route = _interopDefault(require('riot-route'));

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
    var this$1 = this;

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
});

module.exports = route;
