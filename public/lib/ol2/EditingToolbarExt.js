// Customize EditingToolbar
OpenLayers.Control.EditingToolbarExt = OpenLayers.Class(OpenLayers.Control.Panel, {
  // Arrow function (=>) is not supported in ol2
  initialize: function (layer, options) {
    OpenLayers.Control.Panel.prototype.initialize.apply(this, [options])

    this.addControls([
      new OpenLayers.Control.ZoomBox(),
      new OpenLayers.Control.Navigation()
    ])
    const controls = [
      new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point, { displayClass: 'olControlDrawFeaturePoint' }),
      new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Path, { displayClass: 'olControlDrawFeaturePath' }),
      new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, { displayClass: 'olControlDrawFeaturePolygon' }),
      new OpenLayers.Control.ModifyFeature(layer, { displayClass: 'olControlMoveFeature' })
    ]
    this.addControls(controls)
  },

  draw: function () {
    const div = OpenLayers.Control.Panel.prototype.draw.apply(this, arguments)
    if (this.defaultControl === null) {
      this.defaultControl = this.controls[1]
    }
    return div
  },

  CLASS_NAME: 'OpenLayers.Control.EditingToolbar'
})
