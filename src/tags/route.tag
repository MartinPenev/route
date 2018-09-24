<route>

  <virtual if={ show }><yield /></virtual>

  <script>
    if (this.parent && this.parent.parent) {
      let object = riot.util.misc.extend(Object.create(this), this.parent.parent);
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

    this.show = false

    this.parent.route(opts.path, (...args) => {
      if (this.parent.opts.interceptor) {
        this.parent.opts.interceptor(this.opts).then(status => {
          if (status) {
            this.complete(args);
          }
        });
      } else {
        this.complete(args);
      }
    });

    this.complete = (pathArgs) => {
        if (pathArgs.length == 1) {
          args = pathArgs[0];
        } else {
          var args = [], len = pathArgs.length;
          while (len--) args[len] = arguments[len];
        }

        this.on('updated', () => {
          let tags = flatten(this.tags);
          if (tags.length > 0) {
            this.off("updated");

            tags.forEach(function (tag) {
              tag.trigger('route', ...args);
            });
          }
        });

        this.parent.select(this);
    }

    function flatten(tags) {
      return Object.keys(tags)
        .map(key => tags[key])
        .reduce((acc, tag) => acc.concat(tag), [])
    }
  </script>

</route>
