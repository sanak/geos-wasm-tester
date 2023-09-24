import GeosOp from './geosop.js'
import OperationPanel from './operationpanel.js'
import MapIoPanel from './mapiopanel.js'
import TestCasePanel from './testcasepanel.js'

const init = async () => {
  const context = {}
  context.mapIoPanel = new MapIoPanel(context).init()
  context.geosOp = await (new GeosOp(context)).init()
  context.operationPanel = new OperationPanel(context).init()
  context.testCasePanel = new TestCasePanel(context).init()
}

window.onload = (event) => {
  init()
}
