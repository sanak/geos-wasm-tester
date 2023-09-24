import { isEmpty } from './util.js'

export default function MapIoPanel (context) {
  const self = this
  const OpenLayers = window.OpenLayers

  self.featureA = null
  self.featureB = null

  let map, wktfmt, layerInput, layerOutput
  let featureResult, featureExpected

  this.init = () => {
    initMap()

    const chkDisplayInput = document.getElementById('chkDisplayInput')
    chkDisplayInput.addEventListener('change', (e) => {
      displayInputGeometries(e.currentTarget.checked)
    })
    const selPrecisionModel = document.getElementById('selPrecisionModel')
    selPrecisionModel.addEventListener('change', (e) => {
      switchFixedScale(e.currentTarget.value)
    })

    const radInputTypes = document.querySelectorAll('input[type="radio"][name="inputtype"]')
    for (const radInputType of radInputTypes) {
      radInputType.addEventListener('change', (e) => {
        switchInput(e.currentTarget.value)
      })
    }
    const btnClearInput = document.getElementById('btnClearInput')
    btnClearInput.addEventListener('click', () => {
      self.clearInput()
    })
    const btnLoadInput = document.getElementById('btnLoadInput')
    btnLoadInput.addEventListener('click', () => {
      self.loadInput()
    })
    const radOutputTypes = document.querySelectorAll('input[type="radio"][name="outputtype"]')
    for (const radOutputType of radOutputTypes) {
      radOutputType.addEventListener('change', (e) => {
        switchOutput(e.currentTarget.value)
      })
    }
    const btnClearOutput = document.getElementById('btnClearOutput')
    btnClearOutput.addEventListener('click', () => {
      self.clearOutput()
    })
    // Switch default input
    switchInput('a')

    return self
  }

  const initMap = () => {
    const options = {
      units: 'm',
      maxExtent: new OpenLayers.Bounds(
        -100000000000000000000,
        -100000000000000000000,
        100000000000000000000,
        100000000000000000000
      ), // limit of number 'e' format
      controls: [
        new OpenLayers.Control.PanZoomBar(),
        new OpenLayers.Control.MousePosition()
      ],
      numZoomLevels: 16
    }
    map = new OpenLayers.Map('map', options)
    self.map = map // For debug
    wktfmt = new OpenLayers.Format.WKT({
      externalProjection: new OpenLayers.Projection('EPSG:4326')
    })
    const graphic = new OpenLayers.Layer.Image(
      'OpenLayers Image',
      './lib/ol2/img/blank.gif',
      new OpenLayers.Bounds(-100000, -100000, 100000, 100000), // TODO: initial scale ?
      new OpenLayers.Size(426, 426)
    )

    layerInput = new OpenLayers.Layer.Vector('Input Vector Layer', {
      styleMap: new OpenLayers.StyleMap({
        temporary: OpenLayers.Feature.Vector.style.default,
        default: OpenLayers.Feature.Vector.style.default,
        select: OpenLayers.Feature.Vector.style.select
      })
    })
    layerInput.events.on({
      featureadded: onInputFeatureAdded,
      beforefeaturemodified: function (event) {
        const feature = event.feature
        const strtype = getFeatureType(feature)
        setInputType(strtype)
        updateInput()
        feature.layer.redraw() // for vertex marker
      },
      featuremodified: function (event) {
        updateInput()
      },
      afterfeaturemodified: function (event) {
        updateInput()
      }
    })
    layerOutput = new OpenLayers.Layer.Vector('Output Vector Layer')

    map.addLayers([graphic, layerInput, layerOutput])
    map.addControl(new OpenLayers.Control.EditingToolbarExt(layerInput))

    map.zoomToExtent(new OpenLayers.Bounds(-10, -10, 416, 416))
  }

  const onInputFeatureAdded = (event) => {
    const feature = event.feature
    const strtype = getInputType()
    setFeatureType(feature, strtype)
    setFeatureStyle(feature, strtype)
    if (strtype === 'a') {
      if (self.featureA) {
        destroyFeatures(layerInput, self.featureA)
      }
      self.featureA = feature
    } else if (strtype === 'b') {
      if (self.featureB) {
        destroyFeatures(layerInput, self.featureB)
      }
      self.featureB = feature
    }
    updateInput()
  }

  const featureToWkt = (feature) => {
    let str = ''
    if (isEmpty(feature)) {
      return str
    }

    if (feature.constructor !== Array) {
      str = wktfmt.write(feature)
      // not a good idea in general, just for this demo
      str = str.replace(/,/g, ', ')
    } else {
      str = 'GEOMETRYCOLLECTION('
      for (let i = 0; i < feature.length; i++) {
        str += wktfmt.write(feature[i])
        if (i !== feature.length - 1) {
          str += ', '
        }
      }
      str += ')'
    }
    return str
  }

  const featureFromWkt = (wkt) => {
    if (isEmpty(wkt)) {
      return null
    }
    const feature = wktfmt.read(wkt)
    // remove empty geometry from GEOMETRYCOLLECTION
    if (!isEmpty(feature) && feature.constructor === Array) {
      return feature.filter((f) => !isEmpty(f))
    } else {
      return feature
    }
  }

  const addFeatures = (layer, feature) => {
    if (isEmpty(feature)) {
      return
    }

    layerInput.events.un({
      featureadded: onInputFeatureAdded
    })
    if (feature.constructor !== Array) {
      layer.addFeatures([feature])
    } else {
      layer.addFeatures(feature)
    }
    layerInput.events.on({
      featureadded: onInputFeatureAdded
    })
  }

  const zoomToExtent = (feature, isFull) => {
    let bounds
    if (!isEmpty(feature) && !isFull) {
      if (feature.constructor !== Array) {
        bounds = feature.geometry.getBounds()
      } else {
        for (let i = 0; i < feature.length; i++) {
          if (!isEmpty(feature[i])) {
            if (isEmpty(bounds)) {
              bounds = feature[i].geometry.getBounds()
            } else {
              bounds.extend(feature[i].geometry.getBounds())
            }
          }
        }
      }
    } else if (isFull) {
      const features = layerInput.features.concat(layerOutput.features)
      for (let i = 0; i < features.length; i++) {
        if (!isEmpty(features[i])) {
          if (isEmpty(bounds)) {
            bounds = features[i].geometry.getBounds()
          } else {
            bounds.extend(features[i].geometry.getBounds())
          }
        }
      }
    }
    if (!isEmpty(bounds)) {
      map.zoomToExtent(bounds)
    }
  }

  const destroyFeatures = (layer, feature) => {
    if (isEmpty(feature)) {
      return
    }

    if (feature.constructor !== Array) {
      layer.destroyFeatures([feature])
    } else {
      layer.destroyFeatures(feature)
    }
    feature = null
  }

  const setDefaultStyle = (strtype) => {
    if (strtype === 'a') {
      OpenLayers.Feature.Vector.style.default.strokeColor = '#2929fd'
      OpenLayers.Feature.Vector.style.default.fillColor = '#dfdfff'
    } else if (strtype === 'b') {
      OpenLayers.Feature.Vector.style.default.strokeColor = '#a52929'
      OpenLayers.Feature.Vector.style.default.fillColor = '#ffdfdf'
    }
  }

  const setFeatureStyle = (feature, strtype) => {
    if (isEmpty(feature)) {
      return
    }

    const style = {
      fillColor: '#ee9900',
      fillOpacity: 0.4,
      hoverFillColor: 'white',
      hoverFillOpacity: 0.8,
      strokeColor: '#ee9900',
      strokeOpacity: 1,
      strokeWidth: 1,
      strokeLinecap: 'round',
      strokeDashstyle: 'solid',
      hoverStrokeColor: 'red',
      hoverStrokeOpacity: 1,
      hoverStrokeWidth: 0.2,
      pointRadius: 6,
      hoverPointRadius: 1,
      hoverPointUnit: '%',
      pointerEvents: 'visiblePainted',
      cursor: 'inherit'
    }
    if (strtype === 'a') {
      style.strokeColor = '#2929fd'
      style.fillColor = '#dfdfff'
    } else if (strtype === 'b') {
      style.strokeColor = '#a52929'
      style.fillColor = '#ffdfdf'
    } else if (strtype === 'result') {
      style.strokeColor = '#acd62b'
      style.fillColor = '#ffffc2'
    } else if (strtype === 'expected') {
      style.strokeColor = '#2bd656'
      style.fillColor = '#c2ffc2'
    }

    if (feature.constructor !== Array) {
      feature.style = style
    } else {
      for (let i = 0; i < feature.length; i++) {
        feature[i].style = style
      }
    }
  }

  const setFeatureType = (feature, strtype) => {
    if (isEmpty(feature)) {
      return
    }

    if (feature.constructor !== Array) {
      feature.attributes.type = strtype
    } else {
      for (let i = 0; i < feature.length; i++) {
        feature[i].attributes.type = strtype
      }
    }
  }

  const getFeatureType = (feature) => {
    if (isEmpty(feature)) {
      return
    }

    let strtype = ''
    if (feature.constructor !== Array) {
      strtype = feature.attributes.type
    } else if (feature.length > 0) {
      strtype = feature[0].attributes.type
    }
    return strtype
  }

  const displayInputGeometries = (visibility) => {
    layerInput.setVisibility(visibility)
  }

  // TODO: move to IOPanel
  const switchFixedScale = (selected) => {
    const divFixedScale = document.getElementById('divFixedScale')
    if (selected === 'FIXED') {
      divFixedScale.style.display = 'block'
    } else {
      divFixedScale.style.display = 'none'
    }
  }

  this.updatePrecisionModel = (type, scale) => {
    const selPrecisionModel = document.getElementById('selPrecisionModel')
    if (type === 'FLOATING' || type === 'FLOATING_SINGLE') {
      selPrecisionModel.value = type
    } else if (!isEmpty(scale)) {
      selPrecisionModel.value = 'FIXED'
      const txtFixedScale = document.getElementById('txtFixedScale')
      txtFixedScale.value = scale
    }
    switchFixedScale(selPrecisionModel.value)
  }

  const getInputType = () => {
    if (document.getElementById('radA').checked) {
      return 'a'
    } else if (document.getElementById('radB').checked) {
      return 'b'
    }
    return 'a'
  }

  const setInputType = (strtype) => {
    if (strtype === 'a') {
      document.getElementById('radA').checked = true
    } else if (strtype === 'b') {
      document.getElementById('radB').checked = true
    }
  }

  this.setOutputType = (strtype) => {
    if (strtype === 'result') {
      document.getElementById('radResult').checked = true
      switchOutput('result')
    } else if (strtype === 'expected') {
      document.getElementById('radExpected').checked = true
      switchOutput('expected')
    }
  }

  const switchInput = (strtype) => {
    const txtInputA = document.getElementById('txtInputA')
    const txtInputB = document.getElementById('txtInputB')
    if (strtype === 'a') {
      txtInputA.style.display = 'block'
      txtInputB.style.display = 'none'
    } else if (strtype === 'b') {
      txtInputA.style.display = 'none'
      txtInputB.style.display = 'block'
    }
    setDefaultStyle(strtype)
  }

  const updateInput = () => {
    const strtype = getInputType()
    let wkt = ''
    if (strtype === 'a' && self.featureA) {
      wkt = featureToWkt(self.featureA)
      document.getElementById('txtInputA').value = wkt
    } else if (strtype === 'b' && self.featureB) {
      wkt = featureToWkt(self.featureB)
      document.getElementById('txtInputB').value = wkt
    }
    setDefaultStyle(strtype)
  }

  const switchOutput = (strtype) => {
    const txtResult = document.getElementById('txtResult')
    const txtExpected = document.getElementById('txtExpected')
    if (strtype === 'result') {
      txtResult.style.display = 'block'
      txtExpected.style.display = 'none'
    } else if (strtype === 'expected') {
      txtResult.style.display = 'none'
      txtExpected.style.display = 'block'
    }
    setDefaultStyle(strtype)
  }

  this.loadInput = (wkt, strtype) => {
    if (isEmpty(strtype)) {
      strtype = getInputType()
    }
    const txtInputA = document.getElementById('txtInputA')
    const txtInputB = document.getElementById('txtInputB')
    if (strtype === 'a') {
      if (isEmpty(wkt)) {
        wkt = txtInputA.value
      } else {
        txtInputA.value = wkt
      }
    } else if (strtype === 'b') {
      if (isEmpty(wkt)) {
        wkt = txtInputB.value
      } else {
        txtInputB.value = wkt
      }
    }
    const feature = featureFromWkt(wkt)
    if (feature) {
      setFeatureType(feature, strtype)
      setFeatureStyle(feature, strtype)
      addFeatures(layerInput, feature)
      if (strtype === 'a') {
        destroyFeatures(layerInput, self.featureA)
        self.featureA = feature
      } else if (strtype === 'b') {
        destroyFeatures(layerInput, self.featureB)
        self.featureB = feature
      }
      zoomToExtent(feature, false)
    }
  }

  this.loadOutput = (result, expected) => {
    if (!isEmpty(result)) {
      const feature = featureFromWkt(result)
      if (feature) {
        setFeatureStyle(feature, 'result')
        addFeatures(layerOutput, feature)
        destroyFeatures(layerOutput, featureResult)
        featureResult = feature
      }
    }
    if (!isEmpty(expected)) {
      const feature = featureFromWkt(expected)
      if (feature) {
        setFeatureStyle(feature, 'expected')
        addFeatures(layerOutput, feature)
        destroyFeatures(layerOutput, featureExpected)
        featureExpected = feature
      }
    }
    zoomToExtent(null, true)
  }

  this.clearInput = (isAll) => {
    if ((getInputType() === 'a' || isAll)) {
      if (self.featureA) {
        destroyFeatures(layerInput, self.featureA)
      }
      document.getElementById('txtInputA').value = ''
    }
    if ((getInputType() === 'b' || isAll)) {
      if (self.featureB) {
        destroyFeatures(layerInput, self.featureB)
      }
      document.getElementById('txtInputB').value = ''
    }
  }

  this.clearOutput = () => {
    destroyFeatures(layerOutput, featureResult)
    destroyFeatures(layerOutput, featureExpected)
    const txtResult = document.getElementById('txtResult')
    const txtExpected = document.getElementById('txtExpected')
    txtResult.value = ''
    txtExpected.value = ''
    txtResult.style.backgroundColor = '#ffffff'
    txtExpected.style.backgroundColor = '#ffffff'
  }
}
