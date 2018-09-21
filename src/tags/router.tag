<router>

  <yield />

  <script>
    import route from 'riot-route'

    this.route = route.create()
    this.select = target => {
      if (target.show) {
        // Update the view
        this.parent.update();

        this.trigger("change", target);

        // It seems the target is already shown.
        return;
      }

        // Make sure all routes are hidden and unmounted.
      this.tags.route.forEach(r => {
        r.show = false;
      });

      // Update the view
      this.parent.update();

      // Show the correct view
      target.show = true;

      // Update the view
      this.parent.update();

      this.trigger("change", target);
    }

    this.on('mount', () => {
      // To avoid updating route tag before mount, we use setTimeout here
      window.setTimeout(() => route.start(true), 0)
    })

    this.on('unmount', () => {
      this.route.stop()
    })
  </script>

</router>
