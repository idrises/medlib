/* MedLib Agent Guardrails migration — idempotent MSSQL */

/* 1) Memory metadata: kullanıcı eğilimi / güven / hassasiyet ayrımı */
IF COL_LENGTH('appAiUserMemory','MemoryType') IS NULL
  ALTER TABLE appAiUserMemory ADD MemoryType NVARCHAR(60) NOT NULL CONSTRAINT DF_appAiUserMemory_MemoryType DEFAULT 'user_preference';
GO
IF COL_LENGTH('appAiUserMemory','Confidence') IS NULL
  ALTER TABLE appAiUserMemory ADD Confidence NVARCHAR(20) NOT NULL CONSTRAINT DF_appAiUserMemory_Confidence DEFAULT 'high';
GO
IF COL_LENGTH('appAiUserMemory','SensitivityLevel') IS NULL
  ALTER TABLE appAiUserMemory ADD SensitivityLevel NVARCHAR(20) NOT NULL CONSTRAINT DF_appAiUserMemory_Sensitivity DEFAULT 'low';
GO
IF COL_LENGTH('appAiUserMemory','ConsentStatus') IS NULL
  ALTER TABLE appAiUserMemory ADD ConsentStatus NVARCHAR(30) NOT NULL CONSTRAINT DF_appAiUserMemory_Consent DEFAULT 'allowed';
GO
IF COL_LENGTH('appAiUserMemory','CreatedAt') IS NULL
  ALTER TABLE appAiUserMemory ADD CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_appAiUserMemory_CreatedAt DEFAULT GETUTCDATE();
GO
IF COL_LENGTH('appAiUserMemory','ExpiresAt') IS NULL
  ALTER TABLE appAiUserMemory ADD ExpiresAt DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_appAiUserMemory_user_type' AND object_id=OBJECT_ID('appAiUserMemory'))
  CREATE INDEX IX_appAiUserMemory_user_type ON appAiUserMemory(UserID, MemoryType, UpdatedAt DESC);
GO

/* 2) Presentation status + render preview fields */
IF OBJECT_ID('appAiPresentationsV2','U') IS NOT NULL
BEGIN
  IF COL_LENGTH('appAiPresentationsV2','Status') IS NULL
    ALTER TABLE appAiPresentationsV2 ADD Status NVARCHAR(20) NOT NULL CONSTRAINT DF_appAiPresentations_Status DEFAULT 'ready';
  IF COL_LENGTH('appAiPresentationsV2','Error') IS NULL
    ALTER TABLE appAiPresentationsV2 ADD Error NVARCHAR(MAX) NULL;
  IF COL_LENGTH('appAiPresentationsV2','PptxData') IS NULL
    ALTER TABLE appAiPresentationsV2 ADD PptxData VARBINARY(MAX) NULL;
  IF COL_LENGTH('appAiPresentationsV2','PptxBytes') IS NULL
    ALTER TABLE appAiPresentationsV2 ADD PptxBytes INT NULL;
END
GO

/* 3) User file processing state machine */
IF OBJECT_ID('appUserFilesV2','U') IS NOT NULL
BEGIN
  IF COL_LENGTH('appUserFilesV2','StatusChangedAt') IS NULL
    ALTER TABLE appUserFilesV2 ADD StatusChangedAt DATETIME2 NULL;
  IF COL_LENGTH('appUserFilesV2','RetryCount') IS NULL
    ALTER TABLE appUserFilesV2 ADD RetryCount INT NOT NULL CONSTRAINT DF_appUserFiles_RetryCount DEFAULT 0;
  IF COL_LENGTH('appUserFilesV2','LastFailureReason') IS NULL
    ALTER TABLE appUserFilesV2 ADD LastFailureReason NVARCHAR(40) NULL;
  UPDATE appUserFilesV2 SET StatusChangedAt=UploadedAt WHERE StatusChangedAt IS NULL;
END
GO

IF OBJECT_ID('appUserFilesV2','U') IS NOT NULL
AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_appUserFiles_status_changed' AND object_id=OBJECT_ID('appUserFilesV2'))
  CREATE INDEX IX_appUserFiles_status_changed ON appUserFilesV2(Status, StatusChangedAt) WHERE DeletedAt IS NULL;
GO
