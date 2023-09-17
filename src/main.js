import initGeosJs from './geos-wasm/docs/assets/geos.esm.js'
// import initGeosJs from 'https://cdn.skypack.dev/geos-wasm'

export default function Tester (engine) {
  const self = this
  const OpenLayers = engine

  this.featureA = null
  this.featureB = null

  let map, wktfmt, layerInput, layerOutput
  let featureResult, featureExpected
  let geos, xmldom
  let reader, writer

  this.init = async () => {
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
        self.updateInput()
        feature.layer.redraw() // for vertex marker
      },
      featuremodified: function (event) {
        self.updateInput()
      },
      afterfeaturemodified: function (event) {
        self.updateInput()
      }
    })
    layerOutput = new OpenLayers.Layer.Vector('Output Vector Layer')

    map.addLayers([graphic, layerInput, layerOutput])
    map.addControl(new OpenLayers.Control.EditingToolbarExt(layerInput))

    map.zoomToExtent(new OpenLayers.Bounds(-10, -10, 416, 416))

    // init controls and variables
    document.getElementById('radA').click()
    self.updateOperation('envelope')

    try {
      geos = await initGeosJs()
      reader = geos.GEOSWKTReader_create()
      writer = geos.GEOSWKTWriter_create()
    } catch (ex) {
      console.error(`init: ${ex}`)
      geos = null
    }
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
    self.updateInput()
  }

  const isWkt = (str) => {
    // TODO: Better definition
    return str.match(/^[PLMG]+/)
  }

  const formatWkt = (wkt) => {
    const geom = geos.GEOSWKTReader_read(reader, wkt)
    const formatted = geos.GEOSWKTWriter_write(writer, geom)
    return formatted
  }

  const geomFromWkt = (reader, wkt) => {
    if (isEmpty(wkt)) {
      return 0
    }
    // const size = wkt.length + 1
    // const wktPtr = geos.Module._malloc(size)
    // // const wktArr = new Uint8Array(geos.Module.intArrayFromString(wkt))
    // // geos.Module.HEAPU8.set(wktArr, wktPtr)
    // geos.Module.stringToUTF8(wkt, wktPtr, size)
    // const geom = geos.GEOSWKTReader_read(reader, wktPtr)
    // geos.Module._free(wktPtr)
    const geom = geos.GEOSWKTReader_read(reader, wkt)

    if (document.getElementById('selPrecisionModel').value === 'FIXED') {
      const scale = document.getElementById('txtFixedScale').value
      if (!isNaN(scale)) {
        const fixedGeom = geos.GEOSGeom_setPrecision(geom, scale, 0)
        geos.GEOSGeom_destroy(geom)
        return fixedGeom
      }
    }
    return geom
  }

  const geomToWkt = (writer, geom) => {
    if (geom === 0) {
      return 'exception'
    }

    geos.GEOSNormalize(geom)
    // const wktPtr = geos.GEOSWKTWriter_write(writer, geom)
    // const wkt = geos.Module.UTF8ToString(wktPtr)
    // geos.GEOSFree(wktPtr)
    const wkt = geos.GEOSWKTWriter_write(writer, geom)
    return wkt
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

  this.zoomToExtent = (feature, isFull) => {
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
      self.zoomToExtent(feature, false)
    }
  }

  const loadOutput = (result, expected) => {
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
    self.zoomToExtent(null, true)
  }

  const isEmpty = (value) => {
    switch (typeof value) {
      case 'undefined':
        return true
      case 'object':
        if (value == null) {
          return true
        }
        break
      case 'string':
        if (value === '') {
          return true
        }
        break
    }
    return false
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

  const setOutputType = (strtype) => {
    if (strtype === 'result') {
      document.getElementById('radResult').checked = true
      this.switchOutput('result')
    } else if (strtype === 'expected') {
      document.getElementById('radExpected').checked = true
      this.switchOutput('expected')
    }
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

  this.displayInputGeometries = (visibility) => {
    layerInput.setVisibility(visibility)
  }

  this.switchFixedScale = (selected) => {
    const divFixedScale = document.getElementById('divFixedScale')
    if (selected === 'FIXED') {
      divFixedScale.style.display = 'block'
    } else {
      divFixedScale.style.display = 'none'
    }
  }

  const updatePrecisionModel = (type, scale) => {
    const selPrecisionModel = document.getElementById('selPrecisionModel')
    if (type === 'FLOATING' || type === 'FLOATING_SINGLE') {
      selPrecisionModel.value = type
    } else if (!isEmpty(scale)) {
      selPrecisionModel.value = 'FIXED'
      const txtFixedScale = document.getElementById('txtFixedScale')
      txtFixedScale.value = scale
    }
    self.switchFixedScale(selPrecisionModel.value)
  }

  this.switchInput = (strtype) => {
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

  this.updateInput = () => {
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

  this.switchOutput = (strtype) => {
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

  const updateOutput = (result, expected, type) => {
    const txtResult = document.getElementById('txtResult')
    const txtExpected = document.getElementById('txtExpected')
    switch (type) {
      case 'boolean':
        switch (result) {
          case 0:
            result = 'false'
            break
          case 1:
            result = 'true'
            break
          case 2:
            result = 'exception'
            break
        }
        break
      case 'int':
        if (!isEmpty(expected)) {
          expected = parseInt(expected)
        }
        break
      case 'float':
        if (!isEmpty(expected)) {
          expected = parseFloat(expected)
        }
        break
    }
    txtResult.value = result
    txtExpected.value = expected
    if (!isEmpty(result) && !isEmpty(expected)) {
      if (result !== expected) {
        txtResult.style.backgroundColor = '#ffcccc'
        txtExpected.style.backgroundColor = '#ffcccc'
      } else {
        txtResult.style.backgroundColor = '#ccffcc'
        txtExpected.style.backgroundColor = '#ccffcc'
      }
    } else {
      txtResult.style.backgroundColor = '#ffffff'
      txtExpected.style.backgroundColor = '#ffffff'
    }
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

  const setArgument = (idx, label, value, visible, disabled) => {
    const divArg = document.getElementById('divArg' + idx)
    const lblArg = document.getElementById('lblArg' + idx)
    const txtArg = document.getElementById('txtArg' + idx)
    divArg.style.display = visible ? 'flex' : 'none'
    lblArg.textContent = label // FireFox
    lblArg.innerText = label // IE
    txtArg.value = value
    txtArg.disabled = disabled
  }

  this.updateOperation = (opname, arg1, arg2, arg3, arg4, arg5, arg6, arg7) => {
    const selOperation = document.getElementById('selOperation')
    let fncName = selOperation.value
    if (selOperation.selectedIndex >= 0 &&
        selOperation.selectedOptions[0].text.toLowerCase() !== opname.toLowerCase()) {
      const optsOperation = selOperation.options
      for (let i = 0; i < optsOperation.length; i++) {
        if (optsOperation[i].text.toLowerCase() === opname.toLowerCase()) {
          optsOperation[i].selected = true
          fncName = optsOperation[i].value
          break
        }
      }
    }
    const lblMethod = document.getElementById('lblMethod')
    lblMethod.textContent = fncName
    setArgument(1, 'Geometry', 'A', true, true)
    setArgument(2, '', '', false, true)
    setArgument(3, '', '', false, true)
    setArgument(4, '', '', false, true)
    setArgument(5, '', '', false, true)
    setArgument(6, '', '', false, true)
    setArgument(7, '', '', false, true)
    switch (opname.toLowerCase()) {
      // simple unary
      case 'clone':
      case 'envelope':
      case 'linemerge':
      case 'normalize':
      case 'minimumclearanceline':
      case 'reverse':
      case 'makevalid':
      case 'boundary':
      case 'getcentroid':
      case 'convexhull':
      case 'pointonsurface':
      case 'minimumboundingcircle':
      case 'minimumwidth':
      case 'delaunaytriangulation':
      case 'constraineddelaunaytriangulation':
      case 'voronoidiagram':
      case 'polygonize':
      case 'polygonizevalid':
      case 'buildarea':
      case 'unaryunion':
      case 'node':
      case 'coverageunion':
      case 'hasz':
      case 'isempty':
      case 'issimple':
      case 'isvalid':
      case 'area':
      case 'length':
        break
      // simple binary
      case 'nearestpoints':
      case 'difference':
      case 'intersection':
      case 'symdifference':
      case 'union':
      case 'clipbyrect':
      case 'contains':
      case 'coveredby':
      case 'covers':
      case 'crosses':
      case 'disjoint':
      case 'equals':
      case 'intersects':
      case 'overlaps':
      case 'touches':
      case 'within':
      case 'relate':
      case 'project':
      case 'distance':
      case 'frechetdistance':
      case 'hausdorffdistance':
        setArgument(2, 'Geometry', 'B', true, true)
        break
      case 'setprecision':
        setArgument(2, 'Precision', '0.1', true, false)
        setArgument(3, 'Flags', '2', true, false)
        break
      case 'buffer':
        setArgument(2, 'Width', '10', true, false)
        setArgument(3, 'Quadrant Segs', '8', true, false)
        break
      case 'bufferwithstyle':
        setArgument(2, 'Width', '10', true, false)
        setArgument(3, 'Quadrant Segs', '8', true, false)
        setArgument(4, 'End Cap Style', '1', true, false)
        setArgument(5, 'Join Style', '1', true, false)
        setArgument(6, 'Mitre Limit', '10', true, false)
        break
      case 'bufferwithparams':
        setArgument(2, 'Width', '10', true, false)
        setArgument(3, 'Quadrant Segs', '8', true, false)
        setArgument(4, 'End Cap Style', '1', true, false)
        setArgument(5, 'Join Style', '1', true, false)
        setArgument(6, 'Mitre Limit', '10', true, false)
        setArgument(7, 'Single Sided', '0', true, false)
        break
      case 'offsetcurve':
        setArgument(2, 'Width', '10', true, false)
        setArgument(3, 'Quadrant Segs', '8', true, false)
        setArgument(4, 'Join Style', '1', true, false)
        setArgument(5, 'Mitre Limit', '10', true, false)
        break
      case 'singlesidedbuffer':
        setArgument(2, 'Width', '10', true, false)
        setArgument(3, 'Quadrant Segs', '8', true, false)
        setArgument(4, 'Join Style', '1', true, false)
        setArgument(5, 'Mitre Limit', '10', true, false)
        setArgument(6, 'Left Side', '0', true, false)
        break
      case 'concavehull':
        setArgument(2, 'Ratio', '0', true, false)
        setArgument(3, 'Allow Holes', '1', true, false)
        break
      case 'concavehullbylength':
        setArgument(2, 'Length', '0', true, false)
        setArgument(3, 'Allow Holes', '1', true, false)
        break
      case 'concavehullofpolygons':
        setArgument(2, 'Length Ratio', '0', true, false)
        setArgument(3, 'isTight', '1', true, false)
        setArgument(4, 'Allow Holes', '1', true, false)
        break
      case 'densify':
      case 'maximuminscribedcircle':
      case 'simplify':
      case 'topologypreservesimplify':
        setArgument(2, 'Tolerance', '10', true, false)
        break
      case 'distancewithin':
        setArgument(2, 'Geometry', 'B', true, true)
        setArgument(3, 'Distance', '0.00001', true, false) // TODO: reasonable initial value
        break
      case 'largestemptycircle':
      case 'equalsexact':
        setArgument(2, 'Geometry', 'B', true, true)
        setArgument(3, 'Tolerance', '0.00001', true, false) // TODO: reasonable initial value
        break
      case 'relatepattern':
        setArgument(2, 'Geometry', 'B', true, true)
        setArgument(3, 'Pattern', 'FFFFFFFFF', true, false) // TODO: reasonable initial value
        break
      case 'relateboundarynoderule':
        setArgument(2, 'Geometry', 'B', true, true)
        setArgument(3, 'Boundary Node Rule', '1', true, false)
        break
      case 'minimumclearance':
      case 'interpolate':
        setArgument(2, 'Distance', '10', true, false)
        break
      case 'differenceprec':
      case 'intersectionprec':
      case 'symdifferenceprec':
      case 'unionprec':
        setArgument(2, 'Geometry', 'B', true, true)
        setArgument(3, 'Grid Size', '0.0', true, false)
        break
      case 'unaryunionprec':
        setArgument(2, 'Grid Size', '0.0', true, false)
        break
      default:
        alert('"' + opname + '" operation not supported.')
        return false
    }
    if (!isEmpty(arg1)) {
      document.getElementById('txtArg1').value = arg1
    }
    if (!isEmpty(arg2)) {
      document.getElementById('txtArg2').value = arg2
    }
    if (!isEmpty(arg3)) {
      document.getElementById('txtArg3').value = arg3
    }
    if (!isEmpty(arg4)) {
      document.getElementById('txtArg4').value = arg4
    }
    if (!isEmpty(arg5)) {
      document.getElementById('txtArg5').value = arg5
    }
    if (!isEmpty(arg6)) {
      document.getElementById('txtArg6').value = arg6
    }
    if (!isEmpty(arg7)) {
      document.getElementById('txtArg7').value = arg7
    }
    return true
  }

  this.compute = (expected) => {
    self.clearOutput()

    const radExpected = document.getElementById('radExpected')
    if (!isEmpty(expected)) {
      radExpected.disabled = false
      setOutputType('expected')
    } else {
      radExpected.disabled = true
      setOutputType('result')
    }

    const wktA = document.getElementById('txtInputA').value
    const wktB = document.getElementById('txtInputB').value
    const opts = document.getElementById('selOperation').options
    const opname = opts[opts.selectedIndex].text
    const fncname = opts[opts.selectedIndex].value

    if (isEmpty(wktA)) {
      alert('all operation needs Geometry A.')
      return
    }
    let geomB, geomResult, result

    const geomA = geomFromWkt(reader, wktA)

    switch (opname.toLowerCase()) {
      // simple unary (return geometry)
      case 'clone':
      case 'envelope':
      case 'linemerge':
      case 'minimumclearanceline':
      case 'reverse':
      case 'makevalid':
      case 'boundary':
      case 'getcentroid':
      case 'convexhull':
      case 'pointonsurface':
      case 'minimumboundingcircle':
      case 'minimumwidth':
      case 'delaunaytriangulation':
      case 'constraineddelaunaytriangulation':
      case 'voronoidiagram':
      case 'buildarea':
      case 'unaryunion':
      case 'node':
      case 'coverageunion':
        geomResult = geos[fncname](geomA)
        result = geomToWkt(writer, geomResult)
        if (!isEmpty(expected)) {
          expected = geomToWkt(writer, geomFromWkt(reader, expected))
        }
        updateOutput(result, expected, 'wkt')
        loadOutput(result, expected)
        break
      // simple unary (input geom array)
      case 'polygonize':
      case 'polygonizevalid':
        {
          const geoms = []
          const geomType = geos.GEOSGeomTypeId(geomA)
          if (geomType >= 4) {
            const numGeoms = geos.GEOSGetNumGeometries(geomA)
            for (let i = 0; i < numGeoms; i++) {
              const geom = geos.GEOSGetGeometryN(geomA, i)
              geoms.push(geom)
            }
          } else {
            geoms.push(geomA)
          }
          const geomPtrs = new Int32Array(geoms)
          const geomVecPtr = geos.Module._malloc(geomPtrs.length * geomPtrs.BYTES_PER_ELEMENT)
          geos.Module.HEAP32.set(geomPtrs, geomVecPtr >> 2)
          geomResult = geos[fncname](geomVecPtr, geoms.length)
          geos.Module._free(geomVecPtr)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      // simple unary (return scalar (boolean))
      case 'hasz':
      case 'isempty':
      case 'issimple':
      case 'isvalid':
        result = geos[fncname](geomA)
        updateOutput(result, expected, 'boolean')
        break
      // simple unary (return scalar (double))
      case 'area':
      case 'length':
        {
          const valuePtr = geos.Module._malloc(8)
          geos[fncname](geomA, valuePtr)
          const value = geos.Module.getValue(valuePtr, 'double')
          result = value
          geos.Module._free(valuePtr)
          updateOutput(result, expected, 'float')
        }
        break
      // in-place unary (return scalar (int))
      case 'normalize':
        {
          const ret = geos[fncname](geomA)
          if (ret === 0) {
            result = geomToWkt(writer, geomA)
            updateOutput(result, expected, 'wkt')
            loadOutput(result, expected)
          } else if (ret === -1) {
            result = 'exception'
          }
        }
        break
      // simple unary (return scalar (int))
      case 'minimumclearance':
        {
          let distance = document.getElementById('txtArg2').value
          if (isNaN(distance)) {
            alert('Distance value must be number.')
            return
          }
          distance = parseFloat(distance)

          geomResult = geos[fncname](geomA, distance)
          updateOutput(result, expected, 'int')
          loadOutput(result, expected)
        }
        break
      // simple binary (return geometry)
      case 'difference':
      case 'intersection':
      case 'symdifference':
      case 'union':
      case 'clipbyrect':
        if (isEmpty(wktB)) {
          alert('"' + opname + '" operation needs Geometry B.')
          return
        }
        geomB = geomFromWkt(reader, wktB)
        geomResult = geos[fncname](geomA, geomB)
        result = geomToWkt(writer, geomResult)
        if (!isEmpty(expected)) {
          expected = geomToWkt(writer, geomFromWkt(reader, expected))
        }
        updateOutput(result, expected, 'wkt')
        loadOutput(result, expected)
        break
      // simple binary (return coordseq)
      case 'nearestpoints':
        {
          // TODO: fix geos-wasm return type
          if (isEmpty(wktB)) {
            alert('"' + opname + '" operation needs Geometry B.')
            return
          }
          geomB = geomFromWkt(reader, wktB)
          const coordSeq = geos[fncname](geomA, geomB)
          geomResult = geos.GEOSGeom_createLineString(coordSeq)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      // simple binary (return scalar (boolean))
      case 'contains':
      case 'coveredby':
      case 'covers':
      case 'crosses':
      case 'disjoint':
      case 'equals':
      case 'intersects':
      case 'overlaps':
      case 'touches':
      case 'within':
      case 'project':
        if (isEmpty(wktB)) {
          alert('"' + opname + '" operation needs Geometry B.')
          return
        }
        geomB = geomFromWkt(reader, wktB)
        result = geos[fncname](geomA, geomB)
        updateOutput(result, expected, 'boolean')
        break
      // simple binary (return scalar (double))
      case 'distance':
      case 'frechetdistance':
      case 'hausdorffdistance':
        {
          if (isEmpty(wktB)) {
            alert('"' + opname + '" operation needs Geometry B.')
            return
          }
          geomB = geomFromWkt(reader, wktB)
          const valuePtr = geos.Module._malloc(8)
          result = geos[fncname](geomA, geomB, valuePtr)
          const value = geos.Module.getValue(valuePtr, 'double')
          result = value
          geos.Module._free(valuePtr)
          updateOutput(result, expected, 'float')
        }
        break
      // simple binary (return scalar (string))
      case 'relate':
        if (isEmpty(wktB)) {
          alert('"' + opname + '" operation needs Geometry B.')
          return
        }
        geomB = geomFromWkt(reader, wktB)

        result = geos[fncname](geomA, geomB)
        updateOutput(result, expected, 'string')
        break
      // has arguments
      case 'distancewithin':
        {
          if (isEmpty(wktB)) {
            alert('"' + opname + '" operation needs Geometry B.')
            return
          }
          geomB = geomFromWkt(reader, wktB)

          let distance = document.getElementById('txtArg3').value
          if (isNaN(distance)) {
            alert('Distance value must be number.')
            return
          }
          distance = parseFloat(distance)

          result = geos[fncname](geomA, geomB, distance)
          updateOutput(result, expected, 'boolean')
        }
        break
      case 'setprecision':
        {
          let precision = document.getElementById('txtArg2').value
          if (isNaN(precision)) {
            alert('Precision value must be number.')
            return
          }
          precision = parseFloat(precision)

          let flags = document.getElementById('txtArg3').value
          if (isNaN(flags)) {
            flags = 0
          } else {
            flags = parseInt(flags)
            if (flags < 0 || flags > 2) {
              alert('Flags value must be 0-2.')
              return
            }
          }

          geomResult = geos[fncname](geomA, precision, flags)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'buffer':
        {
          let width = document.getElementById('txtArg2').value
          if (isNaN(width)) {
            alert('Width value must be number.')
            return
          }
          width = parseFloat(width)

          let quadsegs = document.getElementById('txtArg3').value
          if (isNaN(quadsegs)) {
            alert('Quadrant Segs value must be number.')
            return
          }
          quadsegs = parseInt(quadsegs)

          geomResult = geos[fncname](geomA, width, quadsegs)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'bufferwithstyle':
        {
          let width = document.getElementById('txtArg2').value
          if (isNaN(width)) {
            alert('Width value must be number.')
            return
          }
          width = parseFloat(width)

          let quadsegs = document.getElementById('txtArg3').value
          if (isNaN(quadsegs)) {
            alert('Quadrant Segs value must be number.')
            return
          }
          quadsegs = parseInt(quadsegs)

          let endCapStyle = document.getElementById('txtArg4').value
          if (isNaN(endCapStyle)) {
            alert('End Cap Style value must be number (1-3).')
            return
          }
          endCapStyle = parseInt(endCapStyle)
          if (endCapStyle < 1 || endCapStyle > 3) {
            alert('End Cap Style value must be 1-3.')
            return
          }

          let joinStyle = document.getElementById('txtArg5').value
          if (isNaN(joinStyle)) {
            alert('Join Style value must be number (1-3).')
            return
          }
          joinStyle = parseInt(joinStyle)
          if (joinStyle < 1 || joinStyle > 3) {
            alert('Join Style value must be 1-3.')
            return
          }

          let mitreLimit = document.getElementById('txtArg6').value
          if (isNaN(mitreLimit)) {
            alert('Mitre Limit value must be number.')
            return
          }
          mitreLimit = parseFloat(mitreLimit)

          geomResult = geos[fncname](geomA, width, quadsegs, endCapStyle, joinStyle, mitreLimit)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'bufferwithparams':
        {
          let width = document.getElementById('txtArg2').value
          if (isNaN(width)) {
            alert('Width value must be number.')
            return
          }
          width = parseFloat(width)

          let quadsegs = document.getElementById('txtArg3').value
          if (isNaN(quadsegs)) {
            alert('Quadrant Segs value must be number.')
            return
          }
          quadsegs = parseInt(quadsegs)

          let endCapStyle = document.getElementById('txtArg4').value
          if (isNaN(endCapStyle)) {
            alert('End Cap Style value must be number (1-3).')
            return
          }
          endCapStyle = parseInt(endCapStyle)
          if (endCapStyle < 1 || endCapStyle > 3) {
            alert('End Cap Style value must be 1-3.')
            return
          }

          let joinStyle = document.getElementById('txtArg5').value
          if (isNaN(joinStyle)) {
            alert('Join Style value must be number (1-3).')
            return
          }
          joinStyle = parseInt(joinStyle)
          if (joinStyle < 1 || joinStyle > 3) {
            alert('Join Style value must be 1-3.')
            return
          }

          let mitreLimit = document.getElementById('txtArg6').value
          if (isNaN(mitreLimit)) {
            alert('Mitre Limit value must be number.')
            return
          }
          mitreLimit = parseFloat(mitreLimit)

          let isSingleSided = document.getElementById('txtArg7').value
          if (isNaN(isSingleSided)) {
            alert('Single Sided value must be number.')
            return
          }
          isSingleSided = parseInt(isSingleSided)
          if (isSingleSided < 0 || isSingleSided > 1) {
            alert('Single Sided value must be 0/1.')
            return
          }
          isSingleSided = parseFloat(isSingleSided)

          const bufferParams = geos.GEOSBufferParams_create()
          geos.GEOSBufferParams_setQuadrantSegments(bufferParams, quadsegs)
          geos.GEOSBufferParams_setEndCapStyle(bufferParams, endCapStyle)
          geos.GEOSBufferParams_setJoinStyle(bufferParams, joinStyle)
          geos.GEOSBufferParams_setMitreLimit(bufferParams, mitreLimit)
          geos.GEOSBufferParams_setSingleSided(bufferParams, isSingleSided)
          geomResult = geos[fncname](geomA, bufferParams, width)
          geos.GEOSFree(bufferParams)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'offsetcurve':
        {
          let width = document.getElementById('txtArg2').value
          if (isNaN(width)) {
            alert('Width value must be number.')
            return
          }
          width = parseFloat(width)

          let quadsegs = document.getElementById('txtArg3').value
          if (isNaN(quadsegs)) {
            alert('Quadrant Segs value must be number.')
            return
          }
          quadsegs = parseInt(quadsegs)

          let joinStyle = document.getElementById('txtArg4').value
          if (isNaN(joinStyle)) {
            alert('Join Style value must be number (1-3).')
            return
          }
          joinStyle = parseInt(joinStyle)
          if (joinStyle < 1 || joinStyle > 3) {
            alert('Join Style value must be 1-3.')
            return
          }

          let mitreLimit = document.getElementById('txtArg5').value
          if (isNaN(mitreLimit)) {
            alert('Mitre Limit value must be number.')
            return
          }
          mitreLimit = parseFloat(mitreLimit)

          geomResult = geos[fncname](geomA, width, quadsegs, joinStyle, mitreLimit)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'singlesidedbuffer':
        {
          let width = document.getElementById('txtArg2').value
          if (isNaN(width)) {
            alert('Width value must be number.')
            return
          }
          width = parseFloat(width)

          let quadsegs = document.getElementById('txtArg3').value
          if (isNaN(quadsegs)) {
            alert('Quadrant Segs value must be number.')
            return
          }
          quadsegs = parseInt(quadsegs)

          let joinStyle = document.getElementById('txtArg4').value
          if (isNaN(joinStyle)) {
            alert('Join Style value must be number (1-3).')
            return
          }
          joinStyle = parseInt(joinStyle)
          if (joinStyle < 1 || joinStyle > 3) {
            alert('Join Style value must be 1-3.')
            return
          }

          let mitreLimit = document.getElementById('txtArg5').value
          if (isNaN(mitreLimit)) {
            alert('Mitre Limit value must be number.')
            return
          }
          mitreLimit = parseFloat(mitreLimit)

          let leftSide = document.getElementById('txtArg6').value
          if (isNaN(leftSide)) {
            alert('Left Side value must be number (0/1).')
            return
          }
          leftSide = parseInt(leftSide)
          if (leftSide < 0 || leftSide > 1) {
            alert('End Cap Style value must be 0-1.')
            return
          }

          geomResult = geos[fncname](geomA, width, quadsegs, joinStyle, mitreLimit, leftSide)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'concavehull':
      case 'concavehullbylength':
        {
          let ratioOrLength = document.getElementById('txtArg2').value
          if (isNaN(ratioOrLength)) {
            alert('Ratio or Length value must be number.')
            return
          }
          ratioOrLength = parseFloat(ratioOrLength)

          let allowHoles = document.getElementById('txtArg3').value
          if (isNaN(allowHoles)) {
            alert('Allow Holes value must be number.')
            return
          }
          allowHoles = parseInt(allowHoles)

          geomResult = geos[fncname](geomA, ratioOrLength, allowHoles)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'concavehullofpolygons':
        {
          let lengthRatio = document.getElementById('txtArg2').value
          if (isNaN(lengthRatio)) {
            alert('Length Ratio value must be number.')
            return
          }
          lengthRatio = parseFloat(lengthRatio)

          let isTight = document.getElementById('txtArg3').value
          if (isNaN(isTight)) {
            alert('Allow Holes value must be number.')
            return
          }
          isTight = parseInt(isTight)

          let allowHoles = document.getElementById('txtArg3').value
          if (isNaN(allowHoles)) {
            alert('Allow Holes value must be number.')
            return
          }
          allowHoles = parseInt(allowHoles)

          geomResult = geos[fncname](geomA, lengthRatio, isTight, allowHoles)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'densify':
      case 'maximuminscribedcircle':
      case 'simplify':
      case 'topologypreservesimplify':
        {
          let tolerance = document.getElementById('txtArg2').value
          if (isNaN(tolerance)) {
            alert('Tolerance value must be number.')
            return
          }
          tolerance = parseFloat(tolerance)

          geomResult = geos[fncname](geomA, tolerance)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'largestemptycircle':
        {
          if (isEmpty(wktB)) {
            alert('"' + opname + '" operation needs Geometry B.')
            return
          }
          geomB = geomFromWkt(reader, wktB)

          let tolerance = document.getElementById('txtArg3').value
          if (isNaN(tolerance)) {
            alert('Tolerance value must be number.')
            return
          }
          tolerance = parseFloat(tolerance)

          geomResult = geos[fncname](geomA, geomB, tolerance)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'equalsexact':
        {
          if (isEmpty(wktB)) {
            alert('"' + opname + '" operation needs Geometry B.')
            return
          }
          geomB = geomFromWkt(reader, wktB)

          let tolerance = document.getElementById('txtArg3').value
          if (isNaN(tolerance)) {
            alert('Tolerance value must be number.')
            return
          }
          tolerance = parseFloat(tolerance)

          result = geos[fncname](geomA, geomB, tolerance)
          updateOutput(result, expected, 'boolean')
        }
        break
      case 'relatepattern':
        {
          if (isEmpty(wktB)) {
            alert('"' + opname + '" operation needs Geometry B.')
            return
          }
          geomB = geomFromWkt(reader, wktB)

          const pattern = document.getElementById('txtArg3').value

          result = geos[fncname](geomA, geomB, pattern)
          updateOutput(result, expected, 'boolean')
        }
        break
      case 'relateboundarynoderule':
        {
          if (isEmpty(wktB)) {
            alert('"' + opname + '" operation needs Geometry B.')
            return
          }
          geomB = geomFromWkt(reader, wktB)

          let bnr = document.getElementById('txtArg3').value
          if (isNaN(bnr)) {
            alert('Boundary Node Rule value must be number (1-4).')
            return
          } else {
            bnr = parseInt(bnr)
            if (bnr < 1 || bnr > 4) {
              alert('Boundary Node Rule value must be number (1-4).')
              return
            }
          }

          result = geos[fncname](geomA, geomB, bnr)
          updateOutput(result, expected, 'string')
        }
        break
      case 'interpolate':
        {
          let distance = document.getElementById('txtArg2').value
          if (isNaN(distance)) {
            alert('Distance value must be number.')
            return
          }
          distance = parseFloat(distance)

          geomResult = geos[fncname](geomA, distance)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'differenceprec':
      case 'intersectionprec':
      case 'symdifferenceprec':
      case 'unionprec':
        {
          if (isEmpty(wktB)) {
            alert('"' + opname + '" operation needs Geometry B.')
            return
          }
          geomB = geomFromWkt(reader, wktB)

          let gridSize = document.getElementById('txtArg3').value
          if (isNaN(gridSize)) {
            alert('Grid Size value must be number.')
            return
          }
          gridSize = parseFloat(gridSize)

          geomResult = geos[fncname](geomA, geomB, gridSize)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
      case 'unaryunionprec':
        {
          let gridSize = document.getElementById('txtArg3').value
          if (isNaN(gridSize)) {
            alert('Grid Size value must be number.')
            return
          }
          gridSize = parseFloat(gridSize)

          geomResult = geos[fncname](geomA, gridSize)
          result = geomToWkt(writer, geomResult)
          if (!isEmpty(expected)) {
            expected = geomToWkt(writer, geomFromWkt(reader, expected))
          }
          updateOutput(result, expected, 'wkt')
          loadOutput(result, expected)
        }
        break
    }
  }

  this.addTestXmls = async (testXmlJsonPath) => {
    const res = await fetch(testXmlJsonPath)
    const testXmlJson = await res.json()
    const selTestXml = document.getElementById('selTestXml')
    const optDefault = document.createElement('option')
    optDefault.selected = true
    optDefault.text = ' --- Select Below ---'
    selTestXml.appendChild(optDefault)
    for (const key of Object.keys(testXmlJson)) {
      if (key.startsWith('//')) {
        continue
      }
      const optGroup = document.createElement('optgroup')
      optGroup.label = key
      selTestXml.appendChild(optGroup)
      const items = testXmlJson[key]
      for (let i = 0; i < items.length; i++) {
        if (items[i].startsWith('//')) {
          continue
        }
        const opt = document.createElement('option')
        opt.text = items[i]
        opt.value = `./tests/${key}/${items[i]}`
        optGroup.appendChild(opt)
      }
    }
  }

  this.loadTestXml = async () => {
    const optsTestXml = document.getElementById('selTestXml').options
    const optsTestCase = document.getElementById('selTestCase').options

    optsTestCase.length = 1

    if (optsTestXml.selectedIndex === 0) {
      xmldom = null
      return
    }
    const filename = optsTestXml[optsTestXml.selectedIndex].value

    const response = await fetch(filename)
    const xmltext = await response.text()
    xmldom = new DOMParser().parseFromString(xmltext, 'text/xml')

    if (!isEmpty(xmldom)) {
      const nodeCases = xmldom.getElementsByTagName('case')
      optsTestCase.length = nodeCases.length + 1
      for (let i = 0; i < nodeCases.length; i++) {
        const desc = nodeCases[i].getElementsByTagName('desc')
        optsTestCase[i + 1].text = `# ${i + 1}${desc.length > 0 ? ' - ' + desc[0].firstChild.data : ''}`
      }
    }
  }

  this.loadTestCase = () => {
    self.clearInput(true)
    self.clearOutput()

    if (isEmpty(xmldom)) {
      return
    }
    const caseIdx =
      document.getElementById('selTestCase').options.selectedIndex
    if (caseIdx === 0) {
      return
    }

    const nodePM = xmldom.getElementsByTagName('precisionModel')[0]
    if (!isEmpty(nodePM)) {
      const pmType = nodePM.getAttribute('type')
      const pmScale = nodePM.getAttribute('scale')
      updatePrecisionModel(pmType, pmScale)
    } else {
      updatePrecisionModel('FLOATING', null)
    }

    const nodeCase = xmldom.getElementsByTagName('case')[caseIdx - 1]
    let a = nodeCase.getElementsByTagName('a')[0].firstChild.data
    a = formatWkt(a)
    let b = null
    const nodeBs = nodeCase.getElementsByTagName('b')
    if (nodeBs.length > 0) {
      b = nodeBs[0].firstChild.data
      b = formatWkt(b)
    }
    const nodeTest = nodeCase.getElementsByTagName('test')[0]
    const nodeOp = nodeTest.getElementsByTagName('op')[0]
    let opname = nodeOp.getAttribute('name')
    const arg1 = nodeOp.getAttribute('arg1')
    const arg2 = nodeOp.getAttribute('arg2')
    let arg3 = nodeOp.getAttribute('arg3')
    let arg4 = nodeOp.getAttribute('arg4')
    let arg5 = nodeOp.getAttribute('arg5')
    let arg6 = nodeOp.getAttribute('arg6')
    const arg7 = nodeOp.getAttribute('arg7')
    let expected = nodeOp.firstChild.data
    expected = expected.replace(/^\s+|\n|\s+$/g, '')
    if (isWkt(expected)) {
      expected = formatWkt(expected)
    }
    switch (opname.toLowerCase()) {
      case 'copy':
        opname = 'clone'
        break
      case 'minclearance':
        opname = 'minimumclearance'
        break
      case 'minclearanceline':
        opname = 'minimumclearanceline'
        break
      case 'reduceprecision':
        opname = 'setPrecision'
        break
      case 'getboundary':
        opname = 'boundary'
        break
      case 'buffermitredjoin':
        opname = 'bufferWithParams'
        arg5 = '2'
        break
      case 'buffersinglesided':
        opname = 'singleSidedBuffer'
        arg6 = (arg4.toLowerCase() === 'left') ? '1' : '0'
        arg3 = ''
        arg4 = '1'
        arg5 = '2'
        break
      case 'getinteriorpoint':
        opname = 'pointOnSurface'
        break
      case 'simplifydp':
        opname = 'simplify'
        break
      case 'simplifytp':
        opname = 'topologyPreserveSimplify'
        break
      case 'iswithindistance':
        opname = 'distanceWithin'
        break
      case 'relatestring':
        opname = 'relate'
        break
      case 'relate':
        opname = 'relatePattern'
        break
      case 'relatebnr':
        opname = 'relateBoundaryNodeRule'
        break
      case 'union':
        if (arg2 !== 'B') {
          opname = 'unaryUnion'
        }
        break
      case 'differenceng':
      case 'differencesr':
        opname = 'differencePrec'
        break
      case 'intersectionng':
      case 'intersectionsr':
        opname = 'intersectionPrec'
        break
      case 'symdifferenceng':
      case 'symdifferencesr':
        opname = 'symDifferencePrec'
        break
      case 'unionng':
      case 'unionsr':
        opname = 'unionPrec'
        if (arg2 !== 'B') {
          opname = 'unaryUnionPrec'
        }
        break
      case 'unaryunionng':
      case 'unaryunionsr':
        opname = 'unaryUnionPrec'
        break
      case 'cliprect':
        opname = 'clipByRect'
        break
    }
    self.loadInput(a, 'a')
    if (!isEmpty(b)) {
      self.loadInput(b, 'b')
    }
    if (self.updateOperation(opname, arg1, arg2, arg3, arg4, arg5, arg6, arg7)) {
      self.compute(expected)
    }
  }
}
