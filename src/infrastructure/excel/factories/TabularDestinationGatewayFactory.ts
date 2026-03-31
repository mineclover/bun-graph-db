import { ExcelFileGateway } from '../gateways/ExcelFileGateway.js'
import type { TabularDestinationGateway } from '../gateways/TabularDestinationGateway.js'
import { createGoogleSheetsGateway } from './GoogleSheetsGatewayFactory.js'

export function createTabularDestinationGateways(): TabularDestinationGateway[] {
  return [new ExcelFileGateway(), createGoogleSheetsGateway()]
}
