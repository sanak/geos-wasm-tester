import { isEmpty } from './util.js'
import initGeosJs from '../geos-wasm/docs/assets/geos.esm.js'
// import initGeosJs from 'https://cdn.skypack.dev/geos-wasm'

export default function GeosOp (context) {
  const self = this
  let geos
  let reader, writer

  this.init = async () => {
    try {
      geos = await initGeosJs()
      reader = geos.GEOSWKTReader_create()
      writer = geos.GEOSWKTWriter_create()
      return self
    } catch (ex) {
      console.error(`init: ${ex}`)
      geos = null
    }
  }

  this.formatWkt = (wkt) => {
    const geom = geos.GEOSWKTReader_read(reader, wkt)
    try {
      const formatted = geos.GEOSWKTWriter_write(writer, geom)
      return formatted
    } finally {
      if (geom > 0) {
        geos.GEOSGeom_destroy(geom)
      }
    }
  }

  const geomFromWkt = (wkt) => {
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
      let scale = document.getElementById('txtFixedScale').value
      if (!isNaN(scale)) {
        scale = parseFloat(scale)
        const fixedGeom = geos.GEOSGeom_setPrecision(geom, scale, 0)
        geos.GEOSGeom_destroy(geom)
        return fixedGeom
      }
    }
    return geom
  }

  const geomToWkt = (geom) => {
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

  const getGeometryArguments = (fncname, isBinary) => {
    const wktA = document.getElementById('txtInputA').value
    const wktB = document.getElementById('txtInputB').value
    if (isEmpty(wktA)) {
      throw new Error('all operation needs Geometry A.')
    }

    const geomA = geomFromWkt(wktA)
    if (isBinary) {
      if (isEmpty(wktB)) {
        throw new Error(`"${fncname}" operation needs Geometry B.`)
      }
      const geomB = geomFromWkt(wktB)
      return [geomA, geomB]
    } else {
      return [geomA]
    }
  }

  const getArgumentValue = (idx, type, min, max) => {
    let value = document.getElementById('txtArg' + idx).value
    const label = document.getElementById('lblArg' + idx).innerText
    if (type === 'int' || type === 'float') {
      if (isNaN(value)) {
        throw new Error(`${label} value must be number.`)
      }
      if (type === 'int') {
        value = parseInt(value)
      } else if (type === 'float') {
        value = parseFloat(value)
      }
      if (!isEmpty(min) && !isEmpty(max)) {
        if (value < min || value > max) {
          throw new Error(`${label} value must be ${min}-${max}.`)
        }
      }
    }
    return value
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
      case 'wkt':
        if (!isEmpty(expected)) {
          expected = geomToWkt(geomFromWkt(expected))
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
    if (type === 'wkt') {
      context.mapIoPanel.loadOutput(result, expected)
    }
  }

  this.compute = (expected) => {
    context.mapIoPanel.clearOutput()

    const radExpected = document.getElementById('radExpected')
    if (!isEmpty(expected)) {
      radExpected.disabled = false
      context.mapIoPanel.setOutputType('expected')
    } else {
      radExpected.disabled = true
      context.mapIoPanel.setOutputType('result')
    }

    const opts = document.getElementById('selOperation').options
    const opname = opts[opts.selectedIndex].text
    const fncname = opts[opts.selectedIndex].value

    let geomA, geomB, geomResult, result
    try {
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
          [geomA] = getGeometryArguments(fncname, false)
          geomResult = geos[fncname](geomA)
          result = geomToWkt(geomResult)
          updateOutput(result, expected, 'wkt')
          break
        // simple unary (input geom array)
        case 'polygonize':
        case 'polygonizevalid':
          {
            [geomA] = getGeometryArguments(fncname, false)
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
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        // simple unary (return scalar (boolean))
        case 'hasz':
        case 'isempty':
        case 'issimple':
        case 'isvalid':
          [geomA] = getGeometryArguments(fncname, false)
          result = geos[fncname](geomA)
          updateOutput(result, expected, 'boolean')
          break
        // simple unary (return scalar (double))
        case 'area':
        case 'length':
          {
            [geomA] = getGeometryArguments(fncname, false)
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
            [geomA] = getGeometryArguments(fncname, false)
            const ret = geos[fncname](geomA)
            if (ret === 0) {
              result = geomToWkt(geomA)
              updateOutput(result, expected, 'wkt')
            } else if (ret === -1) {
              result = 'exception'
            }
          }
          break
        // simple unary (return scalar (int))
        case 'minimumclearance':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const distance = getArgumentValue(2, 'float')
            geomResult = geos[fncname](geomA, distance)
            updateOutput(result, expected, 'int')
            context.mapIoPanel.loadOutput(result, expected)
          }
          break
        // simple binary (return geometry)
        case 'difference':
        case 'intersection':
        case 'symdifference':
        case 'union':
        case 'clipbyrect':
          [geomA, geomB] = getGeometryArguments(fncname, true)
          geomResult = geos[fncname](geomA, geomB)
          result = geomToWkt(geomResult)
          updateOutput(result, expected, 'wkt')
          break
        // simple binary (return coordseq)
        case 'nearestpoints':
          {
            // TODO: fix geos-wasm return type
            [geomA, geomB] = getGeometryArguments(fncname, true)
            const coordSeq = geos[fncname](geomA, geomB)
            geomResult = geos.GEOSGeom_createLineString(coordSeq)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
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
          [geomA, geomB] = getGeometryArguments(fncname, true)
          result = geos[fncname](geomA, geomB)
          updateOutput(result, expected, 'boolean')
          break
        // simple binary (return scalar (double))
        case 'distance':
        case 'frechetdistance':
        case 'hausdorffdistance':
          {
            [geomA, geomB] = getGeometryArguments(fncname, true)
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
          [geomA, geomB] = getGeometryArguments(fncname, true)
          result = geos[fncname](geomA, geomB)
          updateOutput(result, expected, 'string')
          break
        // has arguments
        case 'distancewithin':
          {
            [geomA, geomB] = getGeometryArguments(fncname, true)
            const distance = getArgumentValue(3, 'float')
            result = geos[fncname](geomA, geomB, distance)
            updateOutput(result, expected, 'boolean')
          }
          break
        case 'setprecision':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const precision = getArgumentValue(2, 'float')
            const flags = getArgumentValue(3, 'int', 0, 2)
            geomResult = geos[fncname](geomA, precision, flags)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'buffer':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const width = getArgumentValue(2, 'float')
            const quadsegs = getArgumentValue(3, 'int')
            geomResult = geos[fncname](geomA, width, quadsegs)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'bufferwithstyle':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const width = getArgumentValue(2, 'float')
            const quadsegs = getArgumentValue(3, 'int')
            const endCapStyle = getArgumentValue(4, 'int', 1, 3)
            const joinStyle = getArgumentValue(5, 'int', 1, 3)
            const mitreLimit = getArgumentValue(6, 'float')
            geomResult = geos[fncname](geomA, width, quadsegs, endCapStyle, joinStyle, mitreLimit)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'bufferwithparams':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const width = getArgumentValue(2, 'float')
            const quadsegs = getArgumentValue(3, 'int')
            const endCapStyle = getArgumentValue(4, 'int', 1, 3)
            const joinStyle = getArgumentValue(5, 'int', 1, 3)
            const mitreLimit = getArgumentValue(6, 'float')
            const isSingleSided = getArgumentValue(7, 'int', 0, 1)
            const bufferParams = geos.GEOSBufferParams_create()
            geos.GEOSBufferParams_setQuadrantSegments(bufferParams, quadsegs)
            geos.GEOSBufferParams_setEndCapStyle(bufferParams, endCapStyle)
            geos.GEOSBufferParams_setJoinStyle(bufferParams, joinStyle)
            geos.GEOSBufferParams_setMitreLimit(bufferParams, mitreLimit)
            geos.GEOSBufferParams_setSingleSided(bufferParams, isSingleSided)
            geomResult = geos[fncname](geomA, bufferParams, width)
            geos.GEOSFree(bufferParams)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'offsetcurve':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const width = getArgumentValue(2, 'float')
            const quadsegs = getArgumentValue(3, 'int')
            const joinStyle = getArgumentValue(4, 'int', 1, 3)
            const mitreLimit = getArgumentValue(5, 'float')
            geomResult = geos[fncname](geomA, width, quadsegs, joinStyle, mitreLimit)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'singlesidedbuffer':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const width = getArgumentValue(2, 'float')
            const quadsegs = getArgumentValue(3, 'int')
            const joinStyle = getArgumentValue(4, 'int', 1, 3)
            const mitreLimit = getArgumentValue(5, 'float')
            const leftSide = getArgumentValue(6, 'int', 0, 1)
            geomResult = geos[fncname](geomA, width, quadsegs, joinStyle, mitreLimit, leftSide)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'concavehull':
        case 'concavehullbylength':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const ratioOrLength = getArgumentValue(2, 'float')
            const allowHoles = getArgumentValue(3, 'int', 0, 1)
            geomResult = geos[fncname](geomA, ratioOrLength, allowHoles)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'concavehullofpolygons':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const lengthRatio = getArgumentValue(2, 'float')
            const isTight = getArgumentValue(3, 'int', 0, 1)
            const allowHoles = getArgumentValue(4, 'int', 0, 1)
            geomResult = geos[fncname](geomA, lengthRatio, isTight, allowHoles)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'densify':
        case 'maximuminscribedcircle':
        case 'simplify':
        case 'topologypreservesimplify':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const tolerance = getArgumentValue(2, 'float')
            geomResult = geos[fncname](geomA, tolerance)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'largestemptycircle':
          {
            [geomA, geomB] = getGeometryArguments(fncname, true)
            const tolerance = getArgumentValue(3, 'float')
            geomResult = geos[fncname](geomA, geomB, tolerance)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'equalsexact':
          {
            [geomA, geomB] = getGeometryArguments(fncname, true)
            const tolerance = getArgumentValue(3, 'float')
            result = geos[fncname](geomA, geomB, tolerance)
            updateOutput(result, expected, 'boolean')
          }
          break
        case 'relatepattern':
          {
            [geomA, geomB] = getGeometryArguments(fncname, true)
            const pattern = getArgumentValue(3, 'string')
            result = geos[fncname](geomA, geomB, pattern)
            updateOutput(result, expected, 'boolean')
          }
          break
        case 'relateboundarynoderule':
          {
            [geomA, geomB] = getGeometryArguments(fncname, true)
            const bnr = getArgumentValue(3, 'int', 1, 4)
            result = geos[fncname](geomA, geomB, bnr)
            updateOutput(result, expected, 'string')
          }
          break
        case 'interpolate':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const distance = getArgumentValue(2, 'float')
            geomResult = geos[fncname](geomA, distance)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'differenceprec':
        case 'intersectionprec':
        case 'symdifferenceprec':
        case 'unionprec':
          {
            [geomA, geomB] = getGeometryArguments(fncname, true)
            const gridSize = getArgumentValue(3, 'float')
            geomResult = geos[fncname](geomA, geomB, gridSize)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
        case 'unaryunionprec':
          {
            [geomA] = getGeometryArguments(fncname, false)
            const gridSize = getArgumentValue(3, 'float')
            geomResult = geos[fncname](geomA, gridSize)
            result = geomToWkt(geomResult)
            updateOutput(result, expected, 'wkt')
          }
          break
      }
    } catch (e) {
      console.error(e)
      alert(e.message)
    } finally {
      if (geomA > 0) {
        geos.GEOSGeom_destroy(geomA)
      }
      if (geomB > 0) {
        geos.GEOSGeom_destroy(geomB)
      }
      if (geomResult > 0) {
        geos.GEOSGeom_destroy(geomResult)
      }
    }
  }
}
