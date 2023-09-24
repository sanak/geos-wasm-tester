import { isEmpty, isWkt } from './util.js'

export default function TestCasePanel (context) {
  const self = this
  let xmldom

  this.init = () => {
    const path = location.href.replace('index.html', '')
    addTestXmls(`${path}/tests/testxml.json`)

    const btnLoadTestXml = document.getElementById('btnLoadTestXml')
    const selTestCase = document.getElementById('selTestCase')
    btnLoadTestXml.addEventListener('click', loadTestXml)
    selTestCase.addEventListener('change', loadTestCase)
    return self
  }

  const addTestXmls = async (testXmlJsonPath) => {
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

  const loadTestXml = async () => {
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

  const loadTestCase = () => {
    context.mapIoPanel.clearInput(true)
    context.mapIoPanel.clearOutput()

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
      context.mapIoPanel.updatePrecisionModel(pmType, pmScale)
    } else {
      context.mapIoPanel.updatePrecisionModel('FLOATING', null)
    }

    const nodeCase = xmldom.getElementsByTagName('case')[caseIdx - 1]
    let a = nodeCase.getElementsByTagName('a')[0].firstChild.data
    a = context.geosOp.normalizeWkt(a)
    let b = null
    const nodeBs = nodeCase.getElementsByTagName('b')
    if (nodeBs.length > 0) {
      b = nodeBs[0].firstChild.data
      b = context.geosOp.normalizeWkt(b)
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
      expected = context.geosOp.normalizeWkt(expected)
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
    context.mapIoPanel.loadInput(a, 'a')
    if (!isEmpty(b)) {
      context.mapIoPanel.loadInput(b, 'b')
    }
    if (context.operationPanel.updateOperation(opname, arg1, arg2, arg3, arg4, arg5, arg6, arg7)) {
      context.geosOp.compute(expected)
    }
  }
}
