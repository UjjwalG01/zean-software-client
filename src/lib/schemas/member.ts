import { z } from "zod";

/**
 * Zod schemas aligned with `db/schema.sql` public.members JSONB columns:
 *   - address           : { permanent, temporary }
 *   - emergency_contact : { name, phone, address }
 *   - physical          : { chest, height, weight, blood_group }
 *   - medical           : { heart_stroke, skin_disease, breathing_difficulty }
 *
 * All string sub-fields are optional / defaulted to "" so partial writes
 * round-trip cleanly through `memberPayload` in supabase-services.
 */

export const AddressBlockSchema = z.object({
  permanent: z.string().trim().max(300).default(""),
  temporary: z.string().trim().max(300).default(""),
});

export const EmergencyContactBlockSchema = z.object({
  name: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(300).default(""),
});

export const PhysicalBlockSchema = z.object({
  chest: z.string().trim().max(20).default(""),
  height: z.string().trim().max(20).default(""),
  weight: z.string().trim().max(20).default(""),
  blood_group: z.string().trim().max(10).default(""),
});

export const MedicalBlockSchema = z.object({
  heart_stroke: z.boolean().default(false),
  skin_disease: z.boolean().default(false),
  breathing_difficulty: z.boolean().default(false),
});

/**
 * Full registration payload used by `AddMember.tsx`.
 * Fields mirror the flat aliases produced by `mapMemberRow`; the service
 * layer folds them back into the JSONB blocks on write.
 */
export const MemberFormSchema = z.object({
  memberCode: z.string().trim().max(40).optional().default(""),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  middleName: z.string().trim().max(80).optional().default(""),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  dob: z.string().trim().max(20).optional().default(""),
  gender: z.string().trim().max(20).optional().default(""),
  nationality: z.string().trim().max(80).optional().default(""),
  religion: z.string().trim().max(80).optional().default(""),
  occupation: z.string().trim().max(120).optional().default(""),

  email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Invalid email address",
    })
    .default(""),
  phone: z.string().trim().min(1, "Phone is required").max(40),
  contactAlt: z.string().trim().max(40).optional().default(""),
  officeName: z.string().trim().max(120).optional().default(""),
  officeAddress: z.string().trim().max(300).optional().default(""),

  permanentAddress: z.string().trim().max(300).optional().default(""),
  temporaryAddress: z.string().trim().max(300).optional().default(""),

  emergencyName: z.string().trim().max(120).optional().default(""),
  emergencyPhone: z.string().trim().max(40).optional().default(""),
  emergencyAddress: z.string().trim().max(300).optional().default(""),

  height: z.string().trim().max(20).optional().default(""),
  weight: z.string().trim().max(20).optional().default(""),
  chest: z.string().trim().max(20).optional().default(""),
  bloodGroup: z.string().trim().max(10).optional().default(""),

  heartStroke: z.boolean().default(false),
  breathingDifficulty: z.boolean().default(false),
  skinDisease: z.boolean().default(false),

  preferences: z.array(z.string().trim().max(80)).default([]),
});

export type MemberFormValues = z.infer<typeof MemberFormSchema>;

/**
 * Compact schema used by the in-page profile edit dialog.
 * Adds explicit permanent/temporary address + emergency block + physical/medical.
 */
export const MemberQuickEditSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Invalid email address",
    })
    .default(""),
  phone: z.string().trim().min(1, "Phone is required").max(40),

  permanentAddress: z.string().trim().max(300).default(""),
  temporaryAddress: z.string().trim().max(300).default(""),

  emergencyName: z.string().trim().max(120).default(""),
  emergencyContactNum: z.string().trim().max(40).default(""),
  emergencyAddress: z.string().trim().max(300).default(""),

  height: z.string().trim().max(20).default(""),
  weight: z.string().trim().max(20).default(""),
  chest: z.string().trim().max(20).default(""),
  bloodGroup: z.string().trim().max(10).default(""),

  heartStroke: z.boolean().default(false),
  skinDisease: z.boolean().default(false),
  breathingDifficulty: z.boolean().default(false),
});

export type MemberQuickEditValues = z.infer<typeof MemberQuickEditSchema>;

/** Utility: format a ZodError into a single user-friendly toast string. */
export function firstZodMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid form data";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}
