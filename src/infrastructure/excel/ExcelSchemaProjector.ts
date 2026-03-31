import {
  DEFAULT_EXCEL_SYSTEM_COLUMNS,
  type ExcelColumnSchema,
  type ExcelSheetSchema,
  type ExcelSystemColumn,
} from './types/ExcelRowSchema.js'

export interface ExcelProjectableAttribute {
  identifier: string
  dataType: string
  required?: boolean
  searchable?: boolean
}

const SYSTEM_COLUMN_METADATA: Record<
  ExcelSystemColumn,
  Pick<ExcelColumnSchema, 'sourceKey' | 'dataType' | 'required' | 'searchable'>
> = {
  __node_id: {
    sourceKey: 'id',
    dataType: 'id',
    required: true,
    searchable: true,
  },
  __title: {
    sourceKey: 'title',
    dataType: 'string',
    required: false,
    searchable: true,
  },
  __content: {
    sourceKey: 'content',
    dataType: 'string',
    required: true,
    searchable: true,
  },
  __description: {
    sourceKey: 'description',
    dataType: 'string',
    required: false,
    searchable: true,
  },
  __created_at: {
    sourceKey: 'createdAt',
    dataType: 'datetime',
    required: true,
    searchable: false,
  },
  __updated_at: {
    sourceKey: 'updatedAt',
    dataType: 'datetime',
    required: true,
    searchable: false,
  },
}

export class ExcelSchemaProjector {
  projectTableSheetSchema(
    tableIdentifier: string,
    sheetName: string,
    attributes: ExcelProjectableAttribute[],
  ): ExcelSheetSchema {
    const systemColumns: ExcelColumnSchema[] = DEFAULT_EXCEL_SYSTEM_COLUMNS.map(
      (columnName, index) => ({
        columnName,
        sourceType: 'system',
        order: index,
        ...SYSTEM_COLUMN_METADATA[columnName],
      }),
    )

    const attributeColumns: ExcelColumnSchema[] = attributes.map(
      (attribute, index) => ({
        columnName: attribute.identifier,
        sourceType: 'attribute',
        sourceKey: attribute.identifier,
        dataType: attribute.dataType,
        required: attribute.required === true,
        searchable: attribute.searchable === true,
        order: systemColumns.length + index,
      }),
    )

    return {
      tableIdentifier,
      sheetName,
      columns: [...systemColumns, ...attributeColumns],
    }
  }
}
