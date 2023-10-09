import ImageLayer from 'ol/layer/Image.js'
import Map from 'ol/Map.js'
import MousePosition from 'ol/control/MousePosition.js'
import View from 'ol/View.js'
import { WKT } from 'ol/format.js'
import {
  // OSM,
  Vector as VectorSource
} from 'ol/source.js'
import { get as getProjection } from 'ol/proj.js'
import Static from 'ol/source/ImageStatic.js'
import {
  // Tile as TileLayer,
  Vector as VectorLayer
} from 'ol/layer.js'
import { createStringXY } from 'ol/coordinate.js'
import { defaults as defaultControls } from 'ol/control.js'
import {
  buffer,
  extend,
  // getCenter,
  getSize
} from 'ol/extent.js'
import CircleStyle from 'ol/style/Circle.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import Style from 'ol/style/Style.js'
import EditBarExt from './lib/ol-ext/control/EditBarExt.js'
import { isEmpty } from './util.js'

export default function MapIoPanel (context) {
  const self = this

  let map
  let wktFormat
  let ALayer, BLayer, resultLayer, expectedLayer
  let editBar

  const state = new Proxy({
    inputType: 'A',
    outputType: 'Result'
  }, {
    // TODO: use this to update UI
  })

  this.init = () => {
    initMap()

    const displayInputCheckbox = document.getElementById('display-input-checkbox')
    displayInputCheckbox.addEventListener('change', (e) => {
      displayInputGeometries(e.currentTarget.checked)
    })
    const precisionModelSelect = document.getElementById('precision-model-select')
    precisionModelSelect.addEventListener('change', (e) => {
      switchFixedScale(e.currentTarget.value)
    })

    const inputTypeRadios = document.querySelectorAll('input[type="radio"][name="input-type"]')
    for (const inputTypeRadio of inputTypeRadios) {
      inputTypeRadio.addEventListener('change', (e) => {
        const newInputType = e.currentTarget.value
        state.inputType = newInputType
        switchInput(newInputType)
      })
    }
    const clearInputButton = document.getElementById('clear-input-button')
    clearInputButton.addEventListener('click', () => {
      self.clearInput()
    })
    const loadInputButton = document.getElementById('load-input-button')
    loadInputButton.addEventListener('click', () => {
      self.loadInput()
    })
    const outputTypeRadios = document.querySelectorAll('input[type="radio"][name="output-type"]')
    for (const outputTypeRadio of outputTypeRadios) {
      outputTypeRadio.addEventListener('change', (e) => {
        const newOutputType = e.currentTarget.value
        state.outputType = newOutputType
        switchOutput(newOutputType)
      })
    }
    const clearOutputButton = document.getElementById('clear-output-button')
    clearOutputButton.addEventListener('click', () => {
      self.clearOutput()
    })
    // Switch default input
    switchInput('A')

    return self
  }

  const initMap = () => {
    const projection = getProjection('EPSG:3857')
    const extent = projection.getExtent()
    ALayer = new VectorLayer({
      source: new VectorSource(),
      style: getDefaultStyle('A')
    })
    const ASource = ALayer.getSource()
    ASource.set('type', 'A')
    ASource.on('addfeature', onInputFeatureChanged)
    ASource.on('changefeature', onInputFeatureChanged)
    ASource.on('removefeature', onInputFeatureChanged)
    BLayer = new VectorLayer({
      source: new VectorSource(),
      style: getDefaultStyle('B')
    })
    const BSource = BLayer.getSource()
    BSource.set('type', 'B')
    BSource.on('addfeature', onInputFeatureChanged)
    BSource.on('changefeature', onInputFeatureChanged)
    BSource.on('removefeature', onInputFeatureChanged)
    resultLayer = new VectorLayer({
      source: new VectorSource(),
      style: getDefaultStyle('Result')
    })
    resultLayer.getSource().set('type', 'Result')
    expectedLayer = new VectorLayer({
      source: new VectorSource(),
      style: getDefaultStyle('Expected')
    })
    expectedLayer.getSource().set('type', 'Expected')
    map = new Map({
      controls: defaultControls().extend([
        new MousePosition({
          coordinateFormat: createStringXY(4),
          projection: 'EPSG:3857',
          className: 'custom-mouse-position',
          target: document.getElementById('mouse-position-div')
        })
      ]),
      layers: [
        new ImageLayer({
          source: new Static({
            url: '/images/blank.gif',
            projection,
            imageExtent: extent
          })
        }),
        // TODO: Needs attribution and layer control
        // new TileLayer({
        //   source: new OSM()
        // }),
        ALayer,
        BLayer,
        resultLayer,
        expectedLayer
      ],
      target: 'map',
      view: new View({
        projection, // 'EPSG:3857',
        center: [0, 0],
        zoom: 1,
        maxZoom: 22
      })
    })
    self.map = map // For debug

    editBar = new EditBarExt({
      interactions: {
        Info: false,
        Split: false,
        Offset: false
      },
      source: ALayer.getSource(),
      layers: filterLayers,
      drawStyle: getDefaultStyle('A'),
      selectStyle: getEditingStyleFunction(),
      modifyStyle: getEditingStyleFunction()
    })
    editBar.setPosition('bottom')
    map.addControl(editBar)

    map.getView().fit([-10, -10, 416, 416])

    wktFormat = new WKT()
  }

  const filterLayers = (layer) => {
    if (state.inputType === 'A') {
      return layer === ALayer
    } else if (state.inputType === 'B') {
      return layer === BLayer
    }
  }

  const getDefaultStyle = (type) => {
    const fillColor = {
      A: 'rgba(200,200,255,0.6)', // 'rgba(223,223,255,0.4)',
      B: 'rgba(255,200,200,0.6)', // 'rgba(255,223,223,0.4)',
      Result: 'rgba(255,255,100,0.6)', // 'rgba(255,255,194,0.4)',
      Expected: 'rgba(194,255,194,0.4)'
    }
    const strokeColor = {
      A: 'rgba(0,0,255,1)', // '#2929fd',
      B: 'rgba(150,0,0,1)', // '#a52929',
      Result: 'rgba(120,180,0,1)', // '#acd62b',
      Expected: '#2bd656'
    }
    return {
      'fill-color': fillColor[type] || 'rgba(200,200,255,0.6)', // 'rgba(223,223,255,0.4)',
      'stroke-color': strokeColor[type] || 'rgba(0,0,255,1)', // '#2929fd',
      'stroke-width': 1,
      'circle-radius': 6,
      'circle-fill-color': fillColor[type] || 'rgba(200,200,255,0.6)', // 'rgba(223,223,255,0.4)',
      'circle-stroke-color': strokeColor[type] || 'rgba(0,0,255,1)' // '#2929fd'
    }
  }

  const getEditingStyleFunction = () => {
    const styles = {}
    // Use result color for now
    const fillColor = [255, 255, 100, 0.6]
    const strokeColor = [120, 180, 0, 1]
    const width = 2
    styles.Polygon = [
      new Style({
        fill: new Fill({
          color: fillColor
        })
      }),
      new Style({
        stroke: new Stroke({
          color: strokeColor,
          width
        })
      })
    ]
    styles.MultiPolygon = styles.Polygon

    styles.LineString = [
      new Style({
        stroke: new Stroke({
          color: strokeColor,
          width
        })
      })
    ]
    styles.MultiLineString = styles.LineString

    styles.Circle = styles.Polygon // .concat(styles.LineString)

    styles.Point = [
      new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({
            color: fillColor
          }),
          stroke: new Stroke({
            color: strokeColor,
            width
          })
        }),
        zIndex: Infinity
      })
    ]
    styles.MultiPoint = styles.Point

    styles.GeometryCollection = styles.Polygon.concat(
      styles.LineString,
      styles.Point
    )

    return function (feature) {
      if (!feature.getGeometry()) {
        return null
      }
      return styles[feature.getGeometry().getType()]
    }
  }

  const onInputFeatureChanged = (event) => {
    const source = event.target
    updateInput(source)
  }

  const featureToWkt = (features) => {
    let str = ''
    if (isEmpty(features)) {
      return str
    }

    if (features.length === 1) {
      str = wktFormat.writeFeature(features[0])
      // not a good idea in general, just for this demo
      str = str.replace(/,/g, ', ')
    } else {
      str = 'GEOMETRYCOLLECTION('
      for (let i = 0; i < features.length; i++) {
        str += wktFormat.writeFeature(features[i])
        if (i !== features.length - 1) {
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
    // Allow EMPTY in multi geometries to avoid OpenLayers WKT parse error
    if (wkt.startsWith('MULTI') || wkt.startsWith('GEOMETRYCOLLECTION')) {
      if (wkt.indexOf('EMPTY') > 0 && wkt.indexOf('(') > 0) {
        wkt = wkt.replace(/,?\s?EMPTY/g, '')
      }
    }
    const feature = wktFormat.readFeature(wkt)
    return feature
  }

  const zoomToExtent = (feature, isFull) => {
    let extent = null
    if (!isEmpty(feature) && !isFull) {
      if (feature.constructor !== Array) {
        extent = feature.getGeometry().getExtent()
      } else {
        for (let i = 0; i < feature.length; i++) {
          if (!isEmpty(feature[i])) {
            if (isEmpty(extent)) {
              extent = feature[i].getGeometry().getExtent()
            } else {
              extent = extend(extent, feature[i].getGeometry().getExtent())
            }
          }
        }
      }
    } else if (isFull) {
      const features = [ALayer, BLayer, resultLayer, expectedLayer].flatMap((layer) => {
        return layer.getSource().getFeatures()
      })
      for (let i = 0; i < features.length; i++) {
        if (!isEmpty(features[i])) {
          if (isEmpty(extent)) {
            extent = features[i].getGeometry().getExtent()
          } else {
            extent = extend(extent, features[i].getGeometry().getExtent())
          }
        }
      }
    }
    if (!isEmpty(extent)) {
      const size = getSize(extent)
      const max = Math.max(size[0], size[1])
      extent = buffer(extent, max * 0.2)
      map.getView().fit(extent)
    }
  }

  const displayInputGeometries = (visible) => {
    ALayer.setVisible(visible)
    BLayer.setVisible(visible)
  }

  // TODO: move to IOPanel
  const switchFixedScale = (selected) => {
    const fixedScaleDiv = document.getElementById('fixed-scale-div')
    if (selected === 'FIXED') {
      fixedScaleDiv.style.display = 'block'
    } else {
      fixedScaleDiv.style.display = 'none'
    }
  }

  this.updatePrecisionModel = (type, scale) => {
    const precisionModelSelect = document.getElementById('precision-model-select')
    if (type === 'FLOATING' || type === 'FLOATING_SINGLE') {
      precisionModelSelect.value = type
    } else if (!isEmpty(scale)) {
      precisionModelSelect.value = 'FIXED'
      const fixedScaleText = document.getElementById('fixed-scale-text')
      fixedScaleText.value = scale
    }
    switchFixedScale(precisionModelSelect.value)
  }

  this.setOutputType = (type) => {
    if (type === 'Result') {
      document.getElementById('result-radio').checked = true
      switchOutput('Result')
    } else if (type === 'Expected') {
      document.getElementById('expected-radio').checked = true
      switchOutput('Expected')
    }
  }

  const switchInput = (type) => {
    const inputAText = document.getElementById('input-a-text')
    const inputBText = document.getElementById('input-b-text')
    // TODO: Consider to set editBar button's color (blue/red)
    if (type === 'A') {
      inputAText.style.display = 'block'
      inputBText.style.display = 'none'
      editBar.setDrawSourceAndStyle(ALayer.getSource(), getDefaultStyle('A'))
    } else if (type === 'B') {
      inputAText.style.display = 'none'
      inputBText.style.display = 'block'
      editBar.setDrawSourceAndStyle(BLayer.getSource(), getDefaultStyle('B'))
    }
  }

  const updateInput = (source) => {
    const type = source.get('type')
    const features = source.getFeatures()
    let wkt = ''
    if (type === 'A') {
      wkt = featureToWkt(features)
      document.getElementById('input-a-text').value = wkt
    } else if (type === 'B') {
      wkt = featureToWkt(features)
      document.getElementById('input-b-text').value = wkt
    }
  }

  const switchOutput = (type) => {
    const resultText = document.getElementById('result-text')
    const expectedText = document.getElementById('expected-text')
    if (type === 'Result') {
      resultText.style.display = 'block'
      expectedText.style.display = 'none'
    } else if (type === 'Expected') {
      resultText.style.display = 'none'
      expectedText.style.display = 'block'
    }
  }

  this.loadInput = (wkt, type) => {
    if (isEmpty(type)) {
      type = state.inputType
    }
    const inputAText = document.getElementById('input-a-text')
    const inputBText = document.getElementById('input-b-text')
    if (type === 'A') {
      if (isEmpty(wkt)) {
        wkt = inputAText.value
      } else {
        inputAText.value = wkt
      }
    } else if (type === 'B') {
      if (isEmpty(wkt)) {
        wkt = inputBText.value
      } else {
        inputBText.value = wkt
      }
    }
    const feature = featureFromWkt(wkt)
    if (feature) {
      if (type === 'A') {
        ALayer.getSource().clear()
        ALayer.getSource().un('addfeature', onInputFeatureChanged)
        ALayer.getSource().addFeature(feature)
        ALayer.getSource().on('addfeature', onInputFeatureChanged)
      } else if (type === 'B') {
        BLayer.getSource().clear()
        BLayer.getSource().un('addfeature', onInputFeatureChanged)
        BLayer.getSource().addFeature(feature)
        BLayer.getSource().on('addfeature', onInputFeatureChanged)
      }
      zoomToExtent(feature, false)
    }
  }

  this.loadOutput = (result, expected) => {
    if (!isEmpty(result)) {
      const feature = featureFromWkt(result)
      if (feature) {
        resultLayer.getSource().clear()
        resultLayer.getSource().addFeature(feature)
      }
    }
    if (!isEmpty(expected)) {
      const feature = featureFromWkt(expected)
      if (feature) {
        expectedLayer.getSource().clear()
        expectedLayer.getSource().addFeature(feature)
      }
    }
    zoomToExtent(null, true)
  }

  this.clearInput = (isAll) => {
    if ((state.inputType === 'A' || isAll)) {
      ALayer.getSource().clear()
      document.getElementById('input-a-text').value = ''
    }
    if ((state.inputType === 'B' || isAll)) {
      BLayer.getSource().clear()
      document.getElementById('input-b-text').value = ''
    }
  }

  this.clearOutput = () => {
    resultLayer.getSource().clear()
    expectedLayer.getSource().clear()
    const resultText = document.getElementById('result-text')
    const expectedText = document.getElementById('expected-text')
    resultText.value = ''
    expectedText.value = ''
    resultText.style.backgroundColor = '#ffffff'
    expectedText.style.backgroundColor = '#ffffff'
  }
}
