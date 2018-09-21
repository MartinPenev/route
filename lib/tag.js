import riot from 'riot';
import route from 'riot-route';

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
            complete(args);
          }
        });
      } else {
        complete(args);
      }
    });

    function complete(pathArgs) {
        var arguments$1 = arguments;
        var this$1 = this;

        if (pathArgs.length == 1) {
          args = pathArgs[0];
        } else {
          var args = [], len = pathArgs.length;
          while (len--) { args[len] = arguments$1[len]; }
        }

        this.on('updated', function () {
          var tags = flatten(this$1.tags);
          if (tags.length > 0) {
            this$1.off("updated");

            tags.forEach(function (tag) {
              tag.trigger.apply(tag, [ 'route' ].concat( args ));
            });
          }
        });

        this.parent.select(this);
    }

    function flatten(tags) {
      return Object.keys(tags)
        .map(function (key) { return tags[key]; })
        .reduce(function (acc, tag) { return acc.concat(tag); }, [])
    }
});

export default route;
