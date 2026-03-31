import type { ResolvedSyncTargetSelection } from '../TabularSyncTargetRegistry.js'
import type { ExcelTableRow } from '../types/ExcelRowSchema.js'
import type {
  TabularDestinationGateway,
  TabularWritePlan,
} from './TabularDestinationGateway.js'

export class ExcelFileGateway implements TabularDestinationGateway {
  supports(selection: ResolvedSyncTargetSelection): boolean {
    return selection.target.kind === 'excel-file'
  }

  async readRows(
    _selection: ResolvedSyncTargetSelection,
  ): Promise<ExcelTableRow[]> {
    return []
  }

  async writeSheet(_plan: TabularWritePlan): Promise<void> {
    throw new Error(
      'ExcelFileGateway.writeSheet is not implemented yet. Introduce a real xlsx writer in the next phase.',
    )
  }
}
