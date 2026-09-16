import { shell } from 'electron'
import { getDb, getSetting, today } from '../db/index'
import { getSchool } from './school'

/**
 * WhatsApp without any account, key or approval: the app builds the message and
 * hands it to WhatsApp through a wa.me link, with the parent's number and the
 * text already filled in. Staff press Send in WhatsApp itself.
 *
 * This deliberately avoids the unofficial automation libraries that drive
 * WhatsApp Web in the background — they break WhatsApp's terms and get school
 * numbers banned.
 */

export type MessagePurpose = 'fees' | 'absence' | 'reportCard' | 'custom'

export interface Recipient {
  student_id: number
  student_name: string
  /** Kept separately so an English message does not carry an Arabic name. */
  student_name_ar?: string | null
  student_code: string
  guardian_name: string | null
  phone: string | null
  amount?: number
  class_label?: string
}

/**
 * Turns whatever the office typed into the digits-only form wa.me needs.
 * Handles "0912345678", "+218 91 234 5678" and "00218...", using the school's
 * country code for local numbers.
 */
export function normalisePhone(raw: string | null | undefined, countryCode: string): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = countryCode + digits.slice(1)
  else if (!digits.startsWith(countryCode)) digits = countryCode + digits
  digits = digits.replace(/\D/g, '')
  // Shorter than this cannot be a real mobile number in any country.
  return digits.length >= 8 ? digits : null
}

export function countryCode(): string {
  return (getSetting('whatsapp_country_code') ?? '218').replace(/\D/g, '') || '218'
}

const DEFAULT_TEMPLATES: Record<MessagePurpose, { en: string; ar: string }> = {
  fees: {
    en: 'Dear {guardian}, this is a reminder from {school} that {amount} is still owed for {student} ({class}). Please contact the school office. Thank you.',
    ar: 'السيد/ة {guardian}، تذكير من {school} بأن مبلغ {amount} لا يزال مستحقاً عن {student} ({class}). يرجى التواصل مع إدارة المدرسة. شكراً لكم.',
  },
  absence: {
    en: 'Dear {guardian}, {student} ({class}) was marked absent at {school} today, {date}. Please let us know the reason. Thank you.',
    ar: 'السيد/ة {guardian}، تم تسجيل غياب {student} ({class}) في {school} اليوم {date}. نرجو إبلاغنا بالسبب. شكراً لكم.',
  },
  reportCard: {
    en: 'Dear {guardian}, the report card for {student} ({class}) is ready at {school}. You may collect it from the school office. Thank you.',
    ar: 'السيد/ة {guardian}، شهادة درجات {student} ({class}) جاهزة في {school}. يمكنكم استلامها من إدارة المدرسة. شكراً لكم.',
  },
  custom: { en: '{message}', ar: '{message}' },
}

export function getTemplate(purpose: MessagePurpose, lang: 'en' | 'ar'): string {
  return getSetting(`wa_template_${purpose}_${lang}`) ?? DEFAULT_TEMPLATES[purpose][lang]
}

export function buildMessage(
  purpose: MessagePurpose,
  lang: 'en' | 'ar',
  values: Record<string, string>
): string {
  const template = getTemplate(purpose, lang)
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => values[key] ?? '')
}

export interface PreparedMessage {
  student_id: number
  student_name: string
  phone: string | null
  body: string
  link: string | null
  /** Why this one cannot be sent, in plain language. */
  problem: string | null
}

export function prepare(
  recipients: Recipient[],
  purpose: MessagePurpose,
  lang: 'en' | 'ar',
  extra: Record<string, string> = {}
): PreparedMessage[] {
  const school = getSchool()
  const cc = countryCode()
  const schoolName = (lang === 'ar' && school?.name_ar) || school?.name || ''
  const currency = school?.currency ?? ''

  return recipients.map((r) => {
    const phone = normalisePhone(r.phone, cc)
    const student = (lang === 'ar' && r.student_name_ar) || r.student_name
    const body = buildMessage(purpose, lang, {
      guardian: r.guardian_name ?? student,
      student,
      school: schoolName,
      class: r.class_label ?? '',
      date: today(),
      amount: r.amount !== undefined ? `${r.amount} ${currency}` : '',
      ...extra,
    })
    return {
      student_id: r.student_id,
      student_name: student,
      phone,
      body,
      link: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(body)}` : null,
      problem: phone ? null : 'No usable phone number for this parent',
    }
  })
}

/** Opens WhatsApp with the message ready, and records that we contacted them. */
export function send(message: PreparedMessage, purpose: MessagePurpose, userId: number | null): void {
  if (!message.link || !message.phone) throw new Error('This parent has no usable phone number.')
  shell.openExternal(message.link)
  getDb()
    .prepare(`INSERT INTO message_log (student_id, channel, purpose, phone, body, sent_by) VALUES (?, 'whatsapp', ?, ?, ?, ?)`)
    .run(message.student_id, purpose, message.phone, message.body, userId)
}

/** Who has already been contacted about this today — avoids double-messaging. */
export function contactedToday(purpose: MessagePurpose): number[] {
  const rows = getDb()
    .prepare(`SELECT DISTINCT student_id FROM message_log WHERE purpose = ? AND date(sent_at) = date('now') AND student_id IS NOT NULL`)
    .all(purpose) as { student_id: number }[]
  return rows.map((r) => r.student_id)
}

export function history(studentId: number) {
  return getDb()
    .prepare(`SELECT id, purpose, phone, body, sent_at FROM message_log WHERE student_id = ? ORDER BY sent_at DESC LIMIT 50`)
    .all(studentId) as { id: number; purpose: string; phone: string; body: string; sent_at: string }[]
}

/* ---------------- Recipient lists ---------------- */

export function feeDebtors(classId?: number | null): Recipient[] {
  const clauses = ['st.deleted_at IS NULL', "st.status = 'active'"]
  if (classId) clauses.push('sec.class_id = @classId')
  const rows = getDb()
    .prepare(
      `SELECT st.id AS student_id, st.full_name, st.full_name_ar, st.student_code,
              st.guardian_name, st.guardian_phone,
              COALESCE(c.name || ' - ' || sec.name, '') AS class_label,
              COALESCE((SELECT SUM(f.amount) FROM fee_structures f
                         WHERE f.deleted_at IS NULL AND (f.class_id IS NULL OR f.class_id = sec.class_id)), 0)
              - COALESCE((SELECT SUM(p.amount_paid) FROM fee_payments p
                           WHERE p.student_id = st.id AND p.deleted_at IS NULL), 0) AS balance
         FROM students st
         LEFT JOIN sections sec ON sec.id = st.section_id
         LEFT JOIN classes c ON c.id = sec.class_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY balance DESC`
    )
    .all({ classId: classId ?? null }) as (Record<string, unknown> & { balance: number })[]

  return rows
    .filter((r) => r.balance > 0)
    .map((r) => ({
      student_id: r.student_id as number,
      student_name: r.full_name as string,
      student_name_ar: (r.full_name_ar as string) ?? null,
      student_code: r.student_code as string,
      guardian_name: (r.guardian_name as string) ?? null,
      phone: (r.guardian_phone as string) ?? null,
      class_label: r.class_label as string,
      amount: Math.round(r.balance),
    }))
}

export function absentToday(date: string, sectionId?: number | null): Recipient[] {
  const clauses = ['a.date = @date', "a.status = 'absent'", 'a.deleted_at IS NULL', 'st.deleted_at IS NULL']
  if (sectionId) clauses.push('st.section_id = @sectionId')
  const rows = getDb()
    .prepare(
      `SELECT st.id AS student_id, st.full_name, st.full_name_ar, st.student_code,
              st.guardian_name, st.guardian_phone,
              COALESCE(c.name || ' - ' || sec.name, '') AS class_label
         FROM attendance a
         JOIN students st ON st.id = a.student_id
         LEFT JOIN sections sec ON sec.id = st.section_id
         LEFT JOIN classes c ON c.id = sec.class_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY st.full_name`
    )
    .all({ date, sectionId: sectionId ?? null }) as Record<string, unknown>[]

  return rows.map((r) => ({
    student_id: r.student_id as number,
    student_name: r.full_name as string,
    student_name_ar: (r.full_name_ar as string) ?? null,
    student_code: r.student_code as string,
    guardian_name: (r.guardian_name as string) ?? null,
    phone: (r.guardian_phone as string) ?? null,
    class_label: r.class_label as string,
  }))
}

export function oneStudent(studentId: number): Recipient {
  const r = getDb()
    .prepare(
      `SELECT st.id AS student_id, st.full_name, st.full_name_ar, st.student_code,
              st.guardian_name, st.guardian_phone,
              COALESCE(c.name || ' - ' || sec.name, '') AS class_label
         FROM students st
         LEFT JOIN sections sec ON sec.id = st.section_id
         LEFT JOIN classes c ON c.id = sec.class_id
        WHERE st.id = ?`
    )
    .get(studentId) as Record<string, unknown> | undefined
  if (!r) throw new Error('That student could not be found.')
  return {
    student_id: r.student_id as number,
    student_name: r.full_name as string,
    student_name_ar: (r.full_name_ar as string) ?? null,
    student_code: r.student_code as string,
    guardian_name: (r.guardian_name as string) ?? null,
    phone: (r.guardian_phone as string) ?? null,
    class_label: r.class_label as string,
  }
}
