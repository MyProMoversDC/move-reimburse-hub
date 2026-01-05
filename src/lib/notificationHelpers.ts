import { supabase } from '@/integrations/supabase/client';

interface CreateNotificationParams {
  userId: string;
  notificationType: 'approval' | 'decline' | 'appeal_decline' | 'paid';
  referenceType: 'reimbursement' | 'review_bonus' | 'missing_payment';
  referenceId: string;
  title: string;
  message: string;
}

export const createMoverNotification = async ({
  userId,
  notificationType,
  referenceType,
  referenceId,
  title,
  message,
}: CreateNotificationParams) => {
  try {
    const { error } = await supabase
      .from('mover_notifications')
      .insert({
        user_id: userId,
        notification_type: notificationType,
        reference_type: referenceType,
        reference_id: referenceId,
        title,
        message,
      });

    if (error) {
      console.error('Error creating notification:', error);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export const getNotificationMessages = {
  reimbursement: {
    confirmed: {
      en: { title: 'Reimbursement Approved', message: 'Your reimbursement request has been approved.' },
      es: { title: 'Reembolso Aprobado', message: 'Su solicitud de reembolso ha sido aprobada.' },
      ru: { title: 'Возмещение одобрено', message: 'Ваш запрос на возмещение был одобрен.' },
    },
    declined: {
      en: { title: 'Reimbursement Declined', message: 'Your reimbursement request has been declined.' },
      es: { title: 'Reembolso Rechazado', message: 'Su solicitud de reembolso ha sido rechazada.' },
      ru: { title: 'Возмещение отклонено', message: 'Ваш запрос на возмещение был отклонен.' },
    },
    paid: {
      en: { title: 'Reimbursement Paid', message: 'Your reimbursement has been paid.' },
      es: { title: 'Reembolso Pagado', message: 'Su reembolso ha sido pagado.' },
      ru: { title: 'Возмещение оплачено', message: 'Ваше возмещение было оплачено.' },
    },
    appeal_declined: {
      en: { title: 'Appeal Declined', message: 'Your reimbursement appeal has been declined.' },
      es: { title: 'Apelación Rechazada', message: 'Su apelación de reembolso ha sido rechazada.' },
      ru: { title: 'Апелляция отклонена', message: 'Ваша апелляция на возмещение была отклонена.' },
    },
  },
  review_bonus: {
    confirmed: {
      en: { title: 'Review Bonus Approved', message: 'Your customer review submission has been approved.' },
      es: { title: 'Bono de Reseña Aprobado', message: 'Su envío de reseña de cliente ha sido aprobado.' },
      ru: { title: 'Бонус за отзыв одобрен', message: 'Ваша заявка на отзыв клиента была одобрена.' },
    },
    declined: {
      en: { title: 'Review Bonus Declined', message: 'Your customer review submission has been declined.' },
      es: { title: 'Bono de Reseña Rechazado', message: 'Su envío de reseña de cliente ha sido rechazado.' },
      ru: { title: 'Бонус за отзыв отклонен', message: 'Ваша заявка на отзыв клиента была отклонена.' },
    },
    appeal_declined: {
      en: { title: 'Appeal Declined', message: 'Your review bonus appeal has been declined.' },
      es: { title: 'Apelación Rechazada', message: 'Su apelación de bono de reseña ha sido rechazada.' },
      ru: { title: 'Апелляция отклонена', message: 'Ваша апелляция на бонус за отзыв была отклонена.' },
    },
  },
  missing_payment: {
    confirmed: {
      en: { title: 'Missing Payment Confirmed', message: 'Your missing payment report has been confirmed.' },
      es: { title: 'Pago Faltante Confirmado', message: 'Su reporte de pago faltante ha sido confirmado.' },
      ru: { title: 'Пропущенный платеж подтвержден', message: 'Ваш отчет о пропущенном платеже был подтвержден.' },
    },
    declined: {
      en: { title: 'Missing Payment Declined', message: 'Your missing payment report has been declined.' },
      es: { title: 'Pago Faltante Rechazado', message: 'Su reporte de pago faltante ha sido rechazado.' },
      ru: { title: 'Пропущенный платеж отклонен', message: 'Ваш отчет о пропущенном платеже был отклонен.' },
    },
    appeal_declined: {
      en: { title: 'Appeal Declined', message: 'Your missing payment appeal has been declined.' },
      es: { title: 'Apelación Rechazada', message: 'Su apelación de pago faltante ha sido rechazada.' },
      ru: { title: 'Апелляция отклонена', message: 'Ваша апелляция на пропущенный платеж была отклонена.' },
    },
  },
};
