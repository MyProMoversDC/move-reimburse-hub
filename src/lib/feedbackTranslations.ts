import { Language } from './translations';

export const feedbackTranslations: Record<string, Record<Language, string>> = {
  // Form title and description
  formTitle: {
    en: 'Mover Feedback & Improvement Form',
    es: 'Formulario de Comentarios y Mejoras para Mudadores',
    ru: 'Форма обратной связи и улучшений для грузчиков'
  },
  formDescription: {
    en: 'This form is here to give our movers a clear and direct way to share feedback with management. If you have ideas, suggestions, or concerns about anything related to MyProMovers—how we operate, how jobs are run, equipment, scheduling, communication, safety, customer experience, or anything else—this is the right place to share it.',
    es: 'Este formulario está aquí para dar a nuestros mudadores una forma clara y directa de compartir comentarios con la gerencia. Si tienes ideas, sugerencias o preocupaciones sobre cualquier cosa relacionada con MyProMovers—cómo operamos, cómo se realizan los trabajos, equipo, programación, comunicación, seguridad, experiencia del cliente o cualquier otra cosa—este es el lugar correcto para compartirlo.',
    ru: 'Эта форма предназначена для того, чтобы дать нашим грузчикам понятный и прямой способ поделиться обратной связью с руководством. Если у вас есть идеи, предложения или опасения по поводу чего-либо, связанного с MyProMovers — как мы работаем, как выполняются заказы, оборудование, расписание, коммуникация, безопасность, опыт клиентов или что-то еще — это правильное место, чтобы поделиться этим.'
  },
  importantNotice: {
    en: 'Important: Submitting feedback does not automatically mean a change will be made. Some ideas may not be implemented right away—or at all—based on operational, legal, or business reasons. That said, when similar feedback comes from multiple team members, management will absolutely take it into account.',
    es: 'Importante: Enviar comentarios no significa automáticamente que se realizará un cambio. Algunas ideas pueden no implementarse de inmediato—o en absoluto—por razones operacionales, legales o comerciales. Dicho esto, cuando comentarios similares provienen de múltiples miembros del equipo, la gerencia absolutamente los tendrá en cuenta.',
    ru: 'Важно: Отправка отзыва не означает автоматически, что изменения будут внесены. Некоторые идеи могут быть реализованы не сразу — или вообще не реализованы — по операционным, юридическим или деловым причинам. Тем не менее, когда похожие отзывы поступают от нескольких членов команды, руководство обязательно примет их во внимание.'
  },
  
  // Form fields
  feedbackType: {
    en: 'What would you like to share with us?',
    es: '¿Qué te gustaría compartir con nosotros?',
    ru: 'Чем бы вы хотели с нами поделиться?'
  },
  feedbackTypePlaceholder: {
    en: 'Suggestion, concern, idea, or feedback of any kind',
    es: 'Sugerencia, preocupación, idea o comentario de cualquier tipo',
    ru: 'Предложение, озабоченность, идея или любой другой отзыв'
  },
  feedbackArea: {
    en: 'What area does this relate to most?',
    es: '¿A qué área se relaciona más esto?',
    ru: 'К какой области это относится больше всего?'
  },
  operations: {
    en: 'Operations / How jobs are run',
    es: 'Operaciones / Cómo se realizan los trabajos',
    ru: 'Операции / Как выполняются заказы'
  },
  scheduling: {
    en: 'Scheduling or dispatch',
    es: 'Programación o despacho',
    ru: 'Планирование или диспетчеризация'
  },
  equipment: {
    en: 'Equipment or trucks',
    es: 'Equipo o camiones',
    ru: 'Оборудование или грузовики'
  },
  pay: {
    en: 'Pay or compensation structure',
    es: 'Pago o estructura de compensación',
    ru: 'Оплата или структура компенсации'
  },
  safety: {
    en: 'Safety',
    es: 'Seguridad',
    ru: 'Безопасность'
  },
  customer_experience: {
    en: 'Customer experience',
    es: 'Experiencia del cliente',
    ru: 'Опыт клиента'
  },
  communication: {
    en: 'Communication',
    es: 'Comunicación',
    ru: 'Коммуникация'
  },
  other: {
    en: 'Other (please explain)',
    es: 'Otro (por favor explica)',
    ru: 'Другое (пожалуйста, объясните)'
  },
  otherExplanation: {
    en: 'Please explain the other area',
    es: 'Por favor explica la otra área',
    ru: 'Пожалуйста, объясните другую область'
  },
  situationExplanation: {
    en: 'Can you briefly explain the situation or idea?',
    es: '¿Puedes explicar brevemente la situación o idea?',
    ru: 'Можете ли вы кратко объяснить ситуацию или идею?'
  },
  situationPlaceholder: {
    en: "What's happening, what you've noticed, or what you think could be improved",
    es: 'Qué está pasando, qué has notado o qué crees que podría mejorar',
    ru: 'Что происходит, что вы заметили или что, по вашему мнению, можно улучшить'
  },
  improvementSuggestion: {
    en: 'How do you think this could help movers, customers, or the company?',
    es: '¿Cómo crees que esto podría ayudar a los mudadores, clientes o la empresa?',
    ru: 'Как, по вашему мнению, это может помочь грузчикам, клиентам или компании?'
  },
  improvementPlaceholder: {
    en: 'Optional, but helpful',
    es: 'Opcional, pero útil',
    ru: 'Необязательно, но полезно'
  },
  isRecurring: {
    en: 'Have you seen this issue or idea come up more than once?',
    es: '¿Has visto que este problema o idea surja más de una vez?',
    ru: 'Вы видели, как эта проблема или идея возникала более одного раза?'
  },
  yes: {
    en: 'Yes',
    es: 'Sí',
    ru: 'Да'
  },
  no: {
    en: 'No',
    es: 'No',
    ru: 'Нет'
  },
  notSure: {
    en: 'Not sure',
    es: 'No estoy seguro',
    ru: 'Не уверен'
  },
  priority: {
    en: 'Is this something you believe should be reviewed soon, or is it more of a general improvement idea?',
    es: '¿Es esto algo que crees que debería revisarse pronto, o es más bien una idea de mejora general?',
    ru: 'Это то, что, по вашему мнению, следует рассмотреть в ближайшее время, или это скорее общая идея для улучшения?'
  },
  needsAttentionSoon: {
    en: 'Needs attention soon',
    es: 'Necesita atención pronto',
    ru: 'Требует скорого внимания'
  },
  generalImprovement: {
    en: 'General improvement suggestion',
    es: 'Sugerencia de mejora general',
    ru: 'Общее предложение по улучшению'
  },
  additionalNotes: {
    en: 'Anything else you\'d like management to know?',
    es: '¿Algo más que te gustaría que la gerencia supiera?',
    ru: 'Есть ли что-то еще, что вы хотели бы, чтобы руководство знало?'
  },
  additionalNotesPlaceholder: {
    en: 'Optional',
    es: 'Opcional',
    ru: 'Необязательно'
  },
  submit: {
    en: 'Submit Feedback',
    es: 'Enviar Comentarios',
    ru: 'Отправить отзыв'
  },
  submitting: {
    en: 'Submitting...',
    es: 'Enviando...',
    ru: 'Отправка...'
  },
  successTitle: {
    en: 'Feedback Submitted',
    es: 'Comentarios Enviados',
    ru: 'Отзыв отправлен'
  },
  successMessage: {
    en: 'Thank you for your feedback. Management will review it soon.',
    es: 'Gracias por tus comentarios. La gerencia los revisará pronto.',
    ru: 'Спасибо за ваш отзыв. Руководство рассмотрит его в ближайшее время.'
  },
  errorTitle: {
    en: 'Error',
    es: 'Error',
    ru: 'Ошибка'
  },
  errorMessage: {
    en: 'Failed to submit feedback. Please try again.',
    es: 'Error al enviar comentarios. Por favor intenta de nuevo.',
    ru: 'Не удалось отправить отзыв. Пожалуйста, попробуйте снова.'
  },
  
  // History
  historyTitle: {
    en: 'Feedback History',
    es: 'Historial de Comentarios',
    ru: 'История отзывов'
  },
  noFeedback: {
    en: 'You have not submitted any feedback yet.',
    es: 'Aún no has enviado ningún comentario.',
    ru: 'Вы еще не отправили ни одного отзыва.'
  },
  pending: {
    en: 'Pending',
    es: 'Pendiente',
    ru: 'Ожидается'
  },
  reviewed: {
    en: 'Reviewed',
    es: 'Revisado',
    ru: 'Рассмотрено'
  },
  responded: {
    en: 'Responded',
    es: 'Respondido',
    ru: 'Отвечено'
  },
  adminResponse: {
    en: 'Admin Response',
    es: 'Respuesta del Administrador',
    ru: 'Ответ администратора'
  },
  submittedOn: {
    en: 'Submitted on',
    es: 'Enviado el',
    ru: 'Отправлено'
  },
  areas: {
    en: 'Areas',
    es: 'Áreas',
    ru: 'Области'
  },
  situation: {
    en: 'Situation/Idea',
    es: 'Situación/Idea',
    ru: 'Ситуация/Идея'
  },
  suggestion: {
    en: 'Improvement Suggestion',
    es: 'Sugerencia de Mejora',
    ru: 'Предложение по улучшению'
  },
  recurring: {
    en: 'Recurring Issue',
    es: 'Problema Recurrente',
    ru: 'Повторяющаяся проблема'
  },
  
  // Admin
  adminTitle: {
    en: 'Mover Feedback Review',
    es: 'Revisión de Comentarios de Mudadores',
    ru: 'Обзор отзывов грузчиков'
  },
  noFeedbackToReview: {
    en: 'No feedback submissions to review.',
    es: 'No hay comentarios para revisar.',
    ru: 'Нет отзывов для рассмотрения.'
  },
  sendResponse: {
    en: 'Send Response',
    es: 'Enviar Respuesta',
    ru: 'Отправить ответ'
  },
  responseTitle: {
    en: 'Respond to Feedback',
    es: 'Responder a Comentarios',
    ru: 'Ответить на отзыв'
  },
  responsePlaceholder: {
    en: 'Enter your response to the mover...',
    es: 'Ingresa tu respuesta al mudador...',
    ru: 'Введите ваш ответ грузчику...'
  },
  sending: {
    en: 'Sending...',
    es: 'Enviando...',
    ru: 'Отправка...'
  },
  responseSuccess: {
    en: 'Response sent successfully',
    es: 'Respuesta enviada exitosamente',
    ru: 'Ответ успешно отправлен'
  },
  responseError: {
    en: 'Failed to send response',
    es: 'Error al enviar respuesta',
    ru: 'Не удалось отправить ответ'
  },
  markAsReviewed: {
    en: 'Mark as Reviewed',
    es: 'Marcar como Revisado',
    ru: 'Отметить как рассмотрено'
  },
  filterAll: {
    en: 'All',
    es: 'Todos',
    ru: 'Все'
  },
  filterPending: {
    en: 'Pending',
    es: 'Pendientes',
    ru: 'Ожидающие'
  },
  filterReviewed: {
    en: 'Reviewed',
    es: 'Revisados',
    ru: 'Рассмотренные'
  },
  filterResponded: {
    en: 'Responded',
    es: 'Respondidos',
    ru: 'Отвеченные'
  },
  viewDetails: {
    en: 'View Details',
    es: 'Ver Detalles',
    ru: 'Просмотреть детали'
  },
  respondToFeedback: {
    en: 'Respond',
    es: 'Responder',
    ru: 'Ответить'
  }
};

export const t = (key: string, language: Language): string => {
  return feedbackTranslations[key]?.[language] || feedbackTranslations[key]?.['en'] || key;
};
