export type HandbookLanguage = 'en' | 'es' | 'ru';

export const handbookTranslations: Record<HandbookLanguage, {
  handbookManagement: string;
  uploadHandbook: string;
  shareWithTeam: string;
  currentHandbook: string;
  noHandbook: string;
  version: string;
  uploadedAt: string;
  sharedAt: string;
  notShared: string;
  uploadNew: string;
  reupload: string;
  selectFile: string;
  uploading: string;
  analyzing: string;
  shareSuccess: string;
  uploadSuccess: string;
  handbookRequired: string;
  handbookPopupTitle: string;
  handbookPopupMessage: string;
  iHaveReadHandbook: string;
  confirmRead: string;
  viewHandbook: string;
  changesDetected: string;
  viewChanges: string;
  downloadHandbook: string;
  acknowledgments: string;
  usersAcknowledged: string;
  pendingAcknowledgment: string;
  driverQuestion: string;
  areYouDriver: string;
  yes: string;
  no: string;
  uploadDriverLicense: string;
  addressRequired: string;
  addressRequiredMessage: string;
  goToSettings: string;
}> = {
  en: {
    handbookManagement: "Handbook Management",
    uploadHandbook: "Upload Handbook",
    shareWithTeam: "Share with Team",
    currentHandbook: "Current Handbook",
    noHandbook: "No handbook uploaded yet",
    version: "Version",
    uploadedAt: "Uploaded",
    sharedAt: "Shared",
    notShared: "Not shared yet",
    uploadNew: "Upload New Version",
    reupload: "Replace Handbook",
    selectFile: "Select PDF or DOC file",
    uploading: "Uploading...",
    analyzing: "Analyzing changes...",
    shareSuccess: "Handbook shared with all team members",
    uploadSuccess: "Handbook uploaded successfully",
    handbookRequired: "Handbook Review Required",
    handbookPopupTitle: "Company Handbook",
    handbookPopupMessage: "A new company handbook is available. Please review it carefully before continuing.",
    iHaveReadHandbook: "I have read and understand the company handbook",
    confirmRead: "Confirm & Continue",
    viewHandbook: "View Handbook",
    changesDetected: "Changes from Previous Version",
    viewChanges: "View Changes",
    downloadHandbook: "Download Handbook",
    acknowledgments: "Acknowledgments",
    usersAcknowledged: "users have acknowledged",
    pendingAcknowledgment: "pending acknowledgment",
    driverQuestion: "Driver Status",
    areYouDriver: "Are you a driver?",
    yes: "Yes",
    no: "No",
    uploadDriverLicense: "Please upload your driver's license",
    addressRequired: "Address Required",
    addressRequiredMessage: "Your current physical address must be filled in as soon as possible. Please update your profile.",
    goToSettings: "Go to Settings",
  },
  es: {
    handbookManagement: "Gestión del Manual",
    uploadHandbook: "Subir Manual",
    shareWithTeam: "Compartir con el Equipo",
    currentHandbook: "Manual Actual",
    noHandbook: "Aún no se ha subido ningún manual",
    version: "Versión",
    uploadedAt: "Subido",
    sharedAt: "Compartido",
    notShared: "Aún no compartido",
    uploadNew: "Subir Nueva Versión",
    reupload: "Reemplazar Manual",
    selectFile: "Seleccionar archivo PDF o DOC",
    uploading: "Subiendo...",
    analyzing: "Analizando cambios...",
    shareSuccess: "Manual compartido con todos los miembros del equipo",
    uploadSuccess: "Manual subido exitosamente",
    handbookRequired: "Revisión del Manual Requerida",
    handbookPopupTitle: "Manual de la Empresa",
    handbookPopupMessage: "Hay un nuevo manual de la empresa disponible. Por favor revíselo cuidadosamente antes de continuar.",
    iHaveReadHandbook: "He leído y entiendo el manual de la empresa",
    confirmRead: "Confirmar y Continuar",
    viewHandbook: "Ver Manual",
    changesDetected: "Cambios de la Versión Anterior",
    viewChanges: "Ver Cambios",
    downloadHandbook: "Descargar Manual",
    acknowledgments: "Confirmaciones",
    usersAcknowledged: "usuarios han confirmado",
    pendingAcknowledgment: "pendiente de confirmación",
    driverQuestion: "Estado de Conductor",
    areYouDriver: "¿Eres conductor?",
    yes: "Sí",
    no: "No",
    uploadDriverLicense: "Por favor sube tu licencia de conducir",
    addressRequired: "Dirección Requerida",
    addressRequiredMessage: "Tu dirección física actual debe ser completada lo antes posible. Por favor actualiza tu perfil.",
    goToSettings: "Ir a Configuración",
  },
  ru: {
    handbookManagement: "Управление справочником",
    uploadHandbook: "Загрузить справочник",
    shareWithTeam: "Поделиться с командой",
    currentHandbook: "Текущий справочник",
    noHandbook: "Справочник еще не загружен",
    version: "Версия",
    uploadedAt: "Загружено",
    sharedAt: "Опубликовано",
    notShared: "Еще не опубликовано",
    uploadNew: "Загрузить новую версию",
    reupload: "Заменить справочник",
    selectFile: "Выберите файл PDF или DOC",
    uploading: "Загрузка...",
    analyzing: "Анализ изменений...",
    shareSuccess: "Справочник отправлен всем членам команды",
    uploadSuccess: "Справочник успешно загружен",
    handbookRequired: "Требуется ознакомление со справочником",
    handbookPopupTitle: "Справочник компании",
    handbookPopupMessage: "Доступен новый справочник компании. Пожалуйста, внимательно ознакомьтесь с ним перед продолжением.",
    iHaveReadHandbook: "Я прочитал и понимаю справочник компании",
    confirmRead: "Подтвердить и продолжить",
    viewHandbook: "Просмотреть справочник",
    changesDetected: "Изменения по сравнению с предыдущей версией",
    viewChanges: "Посмотреть изменения",
    downloadHandbook: "Скачать справочник",
    acknowledgments: "Подтверждения",
    usersAcknowledged: "пользователей подтвердили",
    pendingAcknowledgment: "ожидают подтверждения",
    driverQuestion: "Статус водителя",
    areYouDriver: "Вы водитель?",
    yes: "Да",
    no: "Нет",
    uploadDriverLicense: "Пожалуйста, загрузите ваше водительское удостоверение",
    addressRequired: "Требуется адрес",
    addressRequiredMessage: "Ваш текущий физический адрес должен быть заполнен как можно скорее. Пожалуйста, обновите ваш профиль.",
    goToSettings: "Перейти к настройкам",
  },
};
