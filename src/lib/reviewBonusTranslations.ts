export type ReviewBonusLanguage = 'en' | 'es' | 'ru';

export const reviewBonusTranslations = {
  en: {
    formTitle: "Customer Review Collection Form",
    instructions: `To help keep things organized and ensure everyone receives their bonuses on time, this form is now required for all customer review submissions. Bonuses are paid once per month during the first week of the new month for all qualifying reviews from the previous month. To qualify, movers must be full-time (minimum 40 hours per week for 8 consecutive weeks).

When completing this form, the foreman must include:
– Customer's full name (exactly as shown on the work order or BOL)
– Invoice number
– Full legal names of all movers who worked the job
– URL of the review
– URL for the review

Each mover listed will receive 1 bonus hour if the review is valid and all required information is provided. If the form is not submitted, the review will not be counted. If the review is later removed by the customer or taken down by Google, the bonus will be voided.`,
    jobDate: "Job Date",
    clientFullName: "Client Full Name",
    clientFullNamePlaceholder: "Must match work order/BOL",
    invoiceNumber: "Invoice Number",
    crewMember: "Crew Member Name",
    required: "(Required)",
    optional: "(Optional)",
    reviewUrl: "Review URL",
    reviewUrlPlaceholder: "https://...",
    screenshotUpload: "Review Screenshot Upload",
    screenshotRequired: "Screenshot is required",
    submit: "Submit Review",
    submitting: "Submitting...",
    successMessage: "✅ Review successfully submitted. Bonus eligibility will be reviewed by management.",
    errorMessage: "Failed to submit review. Please try again.",
    reviewHistory: "Potential Review Bonus History",
    status: "Status",
    pending: "Pending Verification",
    confirmed: "Confirmed",
    declined: "Declined",
    declineReason: "Decline Reason",
    noReviews: "No review submissions yet",
    viewDetails: "View Details",
    close: "Close",
    submitReview: "Submit Customer Review",
  },
  es: {
    formTitle: "Formulario de Recolección de Reseñas de Clientes",
    instructions: `Para ayudar a mantener todo organizado y asegurar que todos reciban sus bonos a tiempo, este formulario ahora es obligatorio para todas las reseñas de clientes. Los bonos se pagan una vez al mes durante la primera semana del nuevo mes por todas las reseñas calificadas del mes anterior. Para calificar, los movers deben ser de tiempo completo (mínimo 40 horas por semana durante 8 semanas consecutivas).

Al completar este formulario, el capataz debe incluir:
– Nombre completo del cliente (exactamente como aparece en la orden de trabajo o BOL)
– Número de factura
– Nombres legales completos de todos los movers que trabajaron en el trabajo
– URL de la reseña
– URL de la reseña

Cada mover listado recibirá 1 hora de bono si la reseña es válida y toda la información requerida es proporcionada. Si el formulario no se envía, la reseña no será contada. Si la reseña es eliminada posteriormente por el cliente o removida por Google, el bono será anulado.`,
    jobDate: "Fecha del Trabajo",
    clientFullName: "Nombre Completo del Cliente",
    clientFullNamePlaceholder: "Debe coincidir con la orden de trabajo/BOL",
    invoiceNumber: "Número de Factura",
    crewMember: "Nombre del Miembro del Equipo",
    required: "(Requerido)",
    optional: "(Opcional)",
    reviewUrl: "URL de la Reseña",
    reviewUrlPlaceholder: "https://...",
    screenshotUpload: "Subir Captura de Pantalla de la Reseña",
    screenshotRequired: "La captura de pantalla es requerida",
    submit: "Enviar Reseña",
    submitting: "Enviando...",
    successMessage: "✅ Reseña enviada exitosamente. La elegibilidad del bono será revisada por la gerencia.",
    errorMessage: "Error al enviar la reseña. Por favor intente de nuevo.",
    reviewHistory: "Historial de Bonos Potenciales por Reseñas",
    status: "Estado",
    pending: "Pendiente de Verificación",
    confirmed: "Confirmado",
    declined: "Rechazado",
    declineReason: "Razón del Rechazo",
    noReviews: "Aún no hay envíos de reseñas",
    viewDetails: "Ver Detalles",
    close: "Cerrar",
    submitReview: "Enviar Reseña de Cliente",
  },
  ru: {
    formTitle: "Форма Сбора Отзывов Клиентов",
    instructions: `Чтобы поддерживать порядок и гарантировать своевременное получение бонусов, эта форма теперь обязательна для всех отзывов клиентов. Бонусы выплачиваются один раз в месяц в течение первой недели нового месяца за все квалифицированные отзывы предыдущего месяца. Для получения права на бонус грузчики должны работать полный рабочий день (минимум 40 часов в неделю в течение 8 последовательных недель).

При заполнении этой формы бригадир должен указать:
– Полное имя клиента (точно как в рабочем заказе или BOL)
– Номер счета
– Полные юридические имена всех грузчиков, работавших на заказе
– URL отзыва
– URL отзыва

Каждый указанный грузчик получит 1 бонусный час, если отзыв действителен и предоставлена вся необходимая информация. Если форма не отправлена, отзыв не будет учтен. Если отзыв будет позже удален клиентом или снят Google, бонус будет аннулирован.`,
    jobDate: "Дата Работы",
    clientFullName: "Полное Имя Клиента",
    clientFullNamePlaceholder: "Должно совпадать с рабочим заказом/BOL",
    invoiceNumber: "Номер Счета",
    crewMember: "Имя Члена Бригады",
    required: "(Обязательно)",
    optional: "(Необязательно)",
    reviewUrl: "URL Отзыва",
    reviewUrlPlaceholder: "https://...",
    screenshotUpload: "Загрузить Скриншот Отзыва",
    screenshotRequired: "Скриншот обязателен",
    submit: "Отправить Отзыв",
    submitting: "Отправка...",
    successMessage: "✅ Отзыв успешно отправлен. Право на бонус будет рассмотрено руководством.",
    errorMessage: "Не удалось отправить отзыв. Пожалуйста, попробуйте снова.",
    reviewHistory: "История Потенциальных Бонусов за Отзывы",
    status: "Статус",
    pending: "Ожидает Проверки",
    confirmed: "Подтверждено",
    declined: "Отклонено",
    declineReason: "Причина Отклонения",
    noReviews: "Пока нет отправленных отзывов",
    viewDetails: "Подробнее",
    close: "Закрыть",
    submitReview: "Отправить Отзыв Клиента",
  },
};
