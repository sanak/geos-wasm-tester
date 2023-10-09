import { shiftKeyOnly, click } from 'ol/events/condition.js'
import Draw from 'ol/interaction/Draw.js'
import LineString from 'ol/geom/LineString.js'
import Polygon from 'ol/geom/Polygon.js'
import Select from 'ol/interaction/Select.js'

import Bar from 'ol-ext/control/Bar.js'
import Button from 'ol-ext/control/Button.js'
import Toggle from 'ol-ext/control/Toggle.js'
import TextButton from 'ol-ext/control/TextButton.js'
import Delete from 'ol-ext/interaction/Delete.js'
import element from 'ol-ext/util/element.js'
import Offset from 'ol-ext/interaction/Offset.js'
import Split from 'ol-ext/interaction/Split.js'
import Transform from 'ol-ext/interaction/Transform.js'
import ModifyFeature from 'ol-ext/interaction/ModifyFeature.js'
import DrawRegular from 'ol-ext/interaction/DrawRegular.js'
import DrawHole from 'ol-ext/interaction/DrawHole.js'

/** Control bar for editing in a layer
 * @constructor
 * @extends {ol_control_Bar}
 * @fires info
 * @param {Object=} options Control options.
 * @param {String} options.className class of the control
 * @param {String} options.target Specify a target if you want the control to be rendered outside of the map's viewport.
 * @param {boolean} options.edition false to remove the edition tools, default true
 * @param {Object} options.interactions List of interactions to add to the bar
 *    ie. Select, Delete, Info, DrawPoint, DrawLine, DrawPolygon
 *    Each interaction can be an interaction or true (to get the default one) or false to remove it from bar
 * @param {ol.source.Vector} options.source Source for the drawn features.
 */
const editBarExt = class EditBarExt extends Bar {
  constructor (options) {
    options = options || {}
    options.interactions = options.interactions || {}

    // New bar
    super({
      className: (options.className ? options.className + ' ' : '') + 'ol-editbar-ext',
      toggleOne: true,
      target: options.target
    })

    this._source = options.source
    this._layers = options.layers
    this._drawStyle = options.drawStyle
    this._selectStyle = options.selectStyle
    this._modifyStyle = options.modifyStyle
    // Add buttons / interaction
    this._interactions = {}
    this._setSelectInteraction(options)
    if (options.edition !== false) {
      this._setEditInteraction(options)
    }
    this._setModifyInteraction(options)
  }

  /**
   * Set the map instance the control is associated with
   * and add its controls associated to this map.
   * @param {_ol_Map_} map The map instance.
   */
  setMap (map) {
    if (this.getMap()) {
      if (this._interactions.Delete) {
        this.getMap().removeInteraction(this._interactions.Delete)
      }
      if (this._interactions.ModifySelect) {
        this.getMap().removeInteraction(this._interactions.ModifySelect)
      }
    }
    super.setMap(map)

    if (this.getMap()) {
      if (this._interactions.Delete) {
        this.getMap().addInteraction(this._interactions.Delete)
      }
      if (this._interactions.ModifySelect) {
        this.getMap().addInteraction(this._interactions.ModifySelect)
      }
    }
  }

  setDrawSourceAndStyle (source, style) {
    this._source = source
    this._drawStyle = style
    if (this._interactions.DrawPoint) {
      this.getMap().removeInteraction(this._interactions.DrawPoint)
      this._interactions.DrawPoint.source_ = source
      this._interactions.DrawPoint.getOverlay().setStyle(style)
      this.getMap().addInteraction(this._interactions.DrawPoint)
    }
    if (this._interactions.DrawLine) {
      this.getMap().removeInteraction(this._interactions.DrawLine)
      this._interactions.DrawLine.source_ = source
      this._interactions.DrawLine.getOverlay().setStyle(style)
      this.getMap().addInteraction(this._interactions.DrawLine)
    }
    if (this._interactions.DrawPolygon) {
      this.getMap().removeInteraction(this._interactions.DrawPolygon)
      this._interactions.DrawPolygon.source_ = source
      this._interactions.DrawPolygon.getOverlay().setStyle(style)
      this.getMap().addInteraction(this._interactions.DrawPolygon)
    }
    if (this._interactions.DrawRegular) {
      this.getMap().removeInteraction(this._interactions.DrawRegular)
      this._interactions.DrawRegular.source_ = source
      this._interactions.DrawRegular.overlayLayer_.setStyle(style)
      this.getMap().addInteraction(this._interactions.DrawRegular)
    }
  }

  /** Get an interaction associated with the bar
   * @param {string} name
   */
  getInteraction (name) {
    return this._interactions[name]
  }

  /** Get the option title */
  _getTitle (option) {
    if (option) {
      if (option.get) {
        return option.get('title')
      } else if (typeof (option) === 'string') {
        return option
      } else {
        return option.title
      }
    }
  }

  /** Add selection tool:
   * 1. a toggle control with a select interaction
   * 2. an option bar to delete / get information on the selected feature
   * @private
   */
  _setSelectInteraction (options) {
    const self = this

    // Sub bar
    const sbar = new Bar()
    let selectCtrl

    // Delete button
    if (options.interactions.Delete !== false) {
      if (options.interactions.Delete instanceof Delete) {
        this._interactions.Delete = options.interactions.Delete
      } else {
        this._interactions.Delete = new Delete()
      }
      const del = this._interactions.Delete
      del.setActive(false)
      if (this.getMap()) {
        this.getMap().addInteraction(del)
      }
      sbar.addControl(new Button({
        className: 'ol-delete',
        title: this._getTitle(options.interactions.Delete) || 'Delete',
        name: 'Delete',
        handleClick: function (e) {
          // Delete selection
          del.delete(selectCtrl.getInteraction().getFeatures())
          const evt = {
            type: 'select',
            selected: [],
            deselected: selectCtrl.getInteraction().getFeatures().getArray().slice(),
            mapBrowserEvent: e.mapBrowserEvent
          }
          selectCtrl.getInteraction().getFeatures().clear()
          selectCtrl.getInteraction().dispatchEvent(evt)
        }
      }))
    }

    // Info button
    if (options.interactions.Info !== false) {
      sbar.addControl(new Button({
        className: 'ol-info',
        name: 'Info',
        title: this._getTitle(options.interactions.Info) || 'Show informations',
        handleClick: function () {
          self.dispatchEvent({
            type: 'info',
            features: selectCtrl.getInteraction().getFeatures()
          })
        }
      }))
    }

    // Select button
    if (options.interactions.Select !== false) {
      if (options.interactions.Select instanceof Select) {
        this._interactions.Select = options.interactions.Select
      } else {
        this._interactions.Select = new Select({
          condition: click,
          layers: this._layers,
          style: this._selectStyle
        })
      }
      const sel = this._interactions.Select
      selectCtrl = new Toggle({
        className: 'ol-selection',
        name: 'Select',
        title: this._getTitle(options.interactions.Select) || 'Select',
        interaction: sel,
        bar: sbar.getControls().length ? sbar : undefined,
        autoActivate: false,
        active: false
      })

      this.addControl(selectCtrl)
      sel.on('change:active', function () {
        if (!sel.getActive()) {
          sel.getFeatures().clear()
        }
      })
    }
  }

  /** Add editing tools
   * @private
   */
  _setEditInteraction (options) {
    if (options.interactions.DrawPoint !== false) {
      if (options.interactions.DrawPoint instanceof Draw) {
        this._interactions.DrawPoint = options.interactions.DrawPoint
      } else {
        this._interactions.DrawPoint = new Draw({
          type: 'Point',
          source: this._source,
          style: this._drawStyle
        })
      }
      const pedit = new Toggle({
        className: 'ol-drawpoint',
        name: 'DrawPoint',
        title: this._getTitle(options.interactions.DrawPoint) || 'Point',
        interaction: this._interactions.DrawPoint,
        autoActivate: true,
        active: true
      })
      this.addControl(pedit)
    }

    if (options.interactions.DrawLine !== false) {
      if (options.interactions.DrawLine instanceof Draw) {
        this._interactions.DrawLine = options.interactions.DrawLine
      } else {
        this._interactions.DrawLine = new Draw({
          type: 'LineString',
          source: this._source,
          style: this._drawStyle,
          // Count inserted points
          geometryFunction: function (coordinates, geometry) {
            if (geometry) {
              geometry.setCoordinates(coordinates)
            } else {
              geometry = new LineString(coordinates)
            }
            this.nbpts = geometry.getCoordinates().length
            return geometry
          }
        })
      }
      const ledit = new Toggle({
        className: 'ol-drawline',
        title: this._getTitle(options.interactions.DrawLine) || 'LineString',
        name: 'DrawLine',
        interaction: this._interactions.DrawLine,
        // Options bar associated with the control
        bar: new Bar({
          controls: [
            new TextButton({
              html: this._getTitle(options.interactions.UndoDraw) || 'undo',
              title: this._getTitle(options.interactions.UndoDraw) || 'delete last point',
              handleClick: function () {
                if (ledit.getInteraction().nbpts > 1) {
                  ledit.getInteraction().removeLastPoint()
                }
              }
            }),
            new TextButton({
              html: this._getTitle(options.interactions.FinishDraw) || 'finish',
              title: this._getTitle(options.interactions.FinishDraw) || 'finish',
              handleClick: function () {
                // Prevent null objects on finishDrawing
                if (ledit.getInteraction().nbpts > 2) {
                  ledit.getInteraction().finishDrawing()
                }
              }
            })
          ]
        })
      })

      this.addControl(ledit)
    }

    if (options.interactions.DrawPolygon !== false) {
      if (options.interactions.DrawPolygon instanceof Draw) {
        this._interactions.DrawPolygon = options.interactions.DrawPolygon
      } else {
        this._interactions.DrawPolygon = new Draw({
          type: 'Polygon',
          source: this._source,
          style: this._drawStyle,
          // Count inserted points
          geometryFunction: function (coordinates, geometry) {
            this.nbpts = coordinates[0].length
            if (geometry) {
              geometry.setCoordinates([coordinates[0].concat([coordinates[0][0]])])
            } else {
              geometry = new Polygon(coordinates)
            }
            return geometry
          }
        })
      }
      this._setDrawPolygon(
        'ol-drawpolygon',
        this._interactions.DrawPolygon,
        this._getTitle(options.interactions.DrawPolygon) || 'Polygon',
        'DrawPolygon',
        options
      )
    }

    // Draw hole
    if (options.interactions.DrawHole !== false) {
      if (options.interactions.DrawHole instanceof DrawHole) {
        this._interactions.DrawHole = options.interactions.DrawHole
      } else {
        this._interactions.DrawHole = new DrawHole({
          style: this._selectStyle,
          // Count inserted points
          geometryFunction: function (coordinates, geometry) {
            this.nbpts = coordinates[0].length
            if (geometry) {
              geometry.setCoordinates([coordinates[0].concat([coordinates[0][0]])])
            } else {
              geometry = new Polygon(coordinates)
            }
            return geometry
          }
        })
      }
      this._setDrawPolygon(
        'ol-drawhole',
        this._interactions.DrawHole,
        this._getTitle(options.interactions.DrawHole) || 'Hole',
        'DrawHole',
        options
      )
    }

    // Draw regular
    if (options.interactions.DrawRegular !== false) {
      const label = { pts: 'pts', circle: 'circle' }
      if (options.interactions.DrawRegular instanceof DrawRegular) {
        this._interactions.DrawRegular = options.interactions.DrawRegular
        label.pts = this._interactions.DrawRegular.get('ptsLabel') || label.pts
        label.circle = this._interactions.DrawRegular.get('circleLabel') || label.circle
      } else {
        this._interactions.DrawRegular = new DrawRegular({
          source: this._source,
          style: this._drawStyle,
          sides: 4
        })
        if (options.interactions.DrawRegular) {
          label.pts = options.interactions.DrawRegular.ptsLabel || label.pts
          label.circle = options.interactions.DrawRegular.circleLabel || label.circle
        }
      }
      const regular = this._interactions.DrawRegular

      const div = document.createElement('DIV')

      const down = element.create('DIV', { parent: div })
      element.addListener(down, ['click', 'touchstart'], function () {
        let sides = regular.getSides() - 1
        if (sides < 2) {
          sides = 2
        }
        regular.setSides(sides)
        text.textContent = sides > 2 ? sides + ' ' + label.pts : label.circle
      })// .bind(this)

      const text = element.create('TEXT', { html: '4 ' + label.pts, parent: div })

      const up = element.create('DIV', { parent: div })
      element.addListener(up, ['click', 'touchstart'], function () {
        let sides = regular.getSides() + 1
        if (sides < 3) {
          sides = 3
        }
        regular.setSides(sides)
        text.textContent = sides + ' ' + label.pts
      })// .bind(this)

      const ctrl = new Toggle({
        className: 'ol-drawregular',
        title: this._getTitle(options.interactions.DrawRegular) || 'Regular',
        name: 'DrawRegular',
        interaction: this._interactions.DrawRegular,
        // Options bar associated with the control
        bar: new Bar({
          controls: [
            new TextButton({
              html: div
            })
          ]
        })
      })
      this.addControl(ctrl)
    }
  }

  /**
   * @private
   */
  _setDrawPolygon (className, interaction, title, name, options) {
    const fedit = new Toggle({
      className,
      name,
      title,
      interaction,
      // Options bar associated with the control
      bar: new Bar({
        controls: [
          new TextButton({
            html: this._getTitle(options.interactions.UndoDraw) || 'undo',
            title: this._getTitle(options.interactions.UndoDraw) || 'undo last point',
            handleClick: function () {
              if (fedit.getInteraction().nbpts > 1) {
                fedit.getInteraction().removeLastPoint()
              }
            }
          }),
          new TextButton({
            html: this._getTitle(options.interactions.FinishDraw) || 'finish',
            title: this._getTitle(options.interactions.FinishDraw) || 'finish',
            handleClick: function () {
              // Prevent null objects on finishDrawing
              if (fedit.getInteraction().nbpts > 3) {
                fedit.getInteraction().finishDrawing()
              }
            }
          })
        ]
      })
    })
    this.addControl(fedit)
    return fedit
  }

  /** Add modify tools
   * @private
   */
  _setModifyInteraction (options) {
    // Modify on selected features
    if (options.interactions.ModifySelect !== false && options.interactions.Select !== false) {
      if (options.interactions.ModifySelect instanceof ModifyFeature) {
        this._interactions.ModifySelect = options.interactions.ModifySelect
      } else {
        this._interactions.ModifySelect = new ModifyFeature({
          features: this.getInteraction('Select').getFeatures(),
          style: this._modifyStyle
        })
      }
      if (this.getMap()) {
        this.getMap().addInteraction(this._interactions.ModifySelect)
      }
      // Activate with select
      this._interactions.ModifySelect.setActive(this._interactions.Select.getActive())
      this._interactions.Select.on('change:active', function () {
        this._interactions.ModifySelect.setActive(this._interactions.Select.getActive())
      }.bind(this))
    }

    if (options.interactions.Transform !== false) {
      if (options.interactions.Transform instanceof Transform) {
        this._interactions.Transform = options.interactions.Transform
      } else {
        this._interactions.Transform = new Transform({
          addCondition: shiftKeyOnly
        })
      }
      const transform = new Toggle({
        html: '<i></i>',
        className: 'ol-transform',
        title: this._getTitle(options.interactions.Transform) || 'Transform',
        name: 'Transform',
        interaction: this._interactions.Transform
      })
      this.addControl(transform)
    }

    if (options.interactions.Split !== false) {
      if (options.interactions.Split instanceof Split) {
        this._interactions.Split = options.interactions.Split
      } else {
        this._interactions.Split = new Split({
          sources: this._source
        })
      }
      const split = new Toggle({
        className: 'ol-split',
        title: this._getTitle(options.interactions.Split) || 'Split',
        name: 'Split',
        interaction: this._interactions.Split
      })
      this.addControl(split)
    }

    if (options.interactions.Offset !== false) {
      if (options.interactions.Offset instanceof Offset) {
        this._interactions.Offset = options.interactions.Offset
      } else {
        this._interactions.Offset = new Offset({
          source: this._source
        })
      }
      const offset = new Toggle({
        html: '<i></i>',
        className: 'ol-offset',
        title: this._getTitle(options.interactions.Offset) || 'Offset',
        name: 'Offset',
        interaction: this._interactions.Offset
      })
      this.addControl(offset)
    }
  }
}

export default editBarExt
