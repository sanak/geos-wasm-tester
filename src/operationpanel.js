import { isEmpty } from './util.js'

export default function OperationPanel (context) {
  const self = this

  this.init = () => {
    const selOperation = document.getElementById('selOperation')
    selOperation.addEventListener('change', (e) => {
      self.updateOperation(e.currentTarget.selectedOptions[0].text)
    })
    const btnCompute = document.getElementById('btnCompute')
    btnCompute.addEventListener('click', () => {
      context.geosOp.compute()
    })
    // Select default operation
    self.updateOperation('envelope')
    return self
  }

  const setArgument = (idx, label, value, visible, disabled) => {
    const divArg = document.getElementById('divArg' + idx)
    const lblArg = document.getElementById('lblArg' + idx)
    const txtArg = document.getElementById('txtArg' + idx)
    divArg.style.display = visible ? 'flex' : 'none'
    lblArg.innerText = label
    txtArg.value = value
    txtArg.disabled = disabled
  }

  const setArgumentValue = (idx, value) => {
    if (!isEmpty(value)) {
      const txtArg = document.getElementById('txtArg' + idx)
      txtArg.value = value
    }
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
    lblMethod.innerText = fncName
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
    setArgumentValue(1, arg1)
    setArgumentValue(2, arg2)
    setArgumentValue(3, arg3)
    setArgumentValue(4, arg4)
    setArgumentValue(5, arg5)
    setArgumentValue(6, arg6)
    setArgumentValue(7, arg7)
    return true
  }
}
