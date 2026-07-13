import { ExportListMenuItem as ExportListMenuItem_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { FormatField as FormatField_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { LimitField as LimitField_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { Page as Page_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { SortBy as SortBy_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { SortOrder as SortOrder_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { LocaleField as LocaleField_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { SelectionToUseField as SelectionToUseField_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { FieldsToExport as FieldsToExport_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { CollectionField as CollectionField_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { ExportPreview as ExportPreview_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { ExportSaveButton as ExportSaveButton_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { ImportPreview as ImportPreview_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { ImportSaveButton as ImportSaveButton_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { default as default_82ac47377d9b983b4f453d7fee5715a0 } from '@/cms/components/LogoIcon'
import { default as default_b32d1b744b22d641571f8ba1beec24d5 } from '@/cms/components/Logo'
import { default as default_7358509217e77cf17c6521581568432b } from '@/cms/components/UsersNavLink'
import { default as default_746ed44f7907005677dc839468b3b8d0 } from '@/cms/components/DashboardStats'
import { default as default_4b8ca4bebcfc3b6fe0b091e9f47e324d } from '@/cms/components/CmsLoginLink'
import { ImportExportProvider as ImportExportProvider_cdf7e044479f899a31f804427d568b36 } from '@payloadcms/plugin-import-export/rsc'
import { S3ClientUploadHandler as S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24 } from '@payloadcms/storage-s3/client'
import { default as default_e5e397131de5d4edff19ad21de30eed6 } from '@/cms/components/UsersView'
import { default as default_40b9bdad9b3f4d85e121643b6609e898 } from '@/cms/components/ImportView'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  "@payloadcms/plugin-import-export/rsc#ExportListMenuItem": ExportListMenuItem_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#FormatField": FormatField_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#LimitField": LimitField_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#Page": Page_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#SortBy": SortBy_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#SortOrder": SortOrder_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#LocaleField": LocaleField_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#SelectionToUseField": SelectionToUseField_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#FieldsToExport": FieldsToExport_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#CollectionField": CollectionField_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#ExportPreview": ExportPreview_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#ExportSaveButton": ExportSaveButton_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#ImportPreview": ImportPreview_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/plugin-import-export/rsc#ImportSaveButton": ImportSaveButton_cdf7e044479f899a31f804427d568b36,
  "@/cms/components/LogoIcon#default": default_82ac47377d9b983b4f453d7fee5715a0,
  "@/cms/components/Logo#default": default_b32d1b744b22d641571f8ba1beec24d5,
  "@/cms/components/UsersNavLink#default": default_7358509217e77cf17c6521581568432b,
  "@/cms/components/DashboardStats#default": default_746ed44f7907005677dc839468b3b8d0,
  "@/cms/components/CmsLoginLink#default": default_4b8ca4bebcfc3b6fe0b091e9f47e324d,
  "@payloadcms/plugin-import-export/rsc#ImportExportProvider": ImportExportProvider_cdf7e044479f899a31f804427d568b36,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24,
  "@/cms/components/UsersView#default": default_e5e397131de5d4edff19ad21de30eed6,
  "@/cms/components/ImportView#default": default_40b9bdad9b3f4d85e121643b6609e898,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1
}
