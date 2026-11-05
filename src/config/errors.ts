export type ErrorDefinition = {
  ref: string;
  bn: string;
  en: string;
};

export const errorCatalogue = {
  VALIDATION_ERROR: {
    ref: 'BL-400',
    bn: 'অনুরোধের তথ্য সঠিক নয়।',
    en: 'The request data is invalid.',
  },
  UNAUTHORIZED: { ref: 'BL-401', bn: 'অনুগ্রহ করে সাইন ইন করুন।', en: 'Please sign in.' },
  FORBIDDEN: {
    ref: 'BL-403',
    bn: 'এই কাজটি করার অনুমতি নেই।',
    en: 'You are not allowed to perform this action.',
  },
  NOT_FOUND: {
    ref: 'BL-404',
    bn: 'অনুরোধটি পাওয়া যায়নি।',
    en: 'The requested resource was not found.',
  },
  CONFLICT: {
    ref: 'BL-409',
    bn: 'তথ্যের সঙ্গে বিরোধ আছে।',
    en: 'The request conflicts with existing data.',
  },
  INVALID_INPUT: {
    ref: 'BL-422',
    bn: 'প্রদত্ত তথ্য গ্রহণযোগ্য নয়।',
    en: 'The provided information is not acceptable.',
  },
  RATE_LIMITED: {
    ref: 'BL-429',
    bn: 'অনেকবার চেষ্টা করা হয়েছে। পরে আবার চেষ্টা করুন।',
    en: 'Too many attempts. Please try again later.',
  },
  INTERNAL_ERROR: {
    ref: 'BL-500',
    bn: 'সার্ভারে একটি সমস্যা হয়েছে।',
    en: 'An unexpected server error occurred.',
  },
  SERVICE_UNAVAILABLE: {
    ref: 'BL-503',
    bn: 'সেবাটি সাময়িকভাবে অনুপলব্ধ।',
    en: 'The service is temporarily unavailable.',
  },
  EMAIL_UNVERIFIED: { ref: 'BL-100', bn: 'ইমেইল যাচাই করা হয়নি।', en: 'Email is not verified.' },
  ACCOUNT_SUSPENDED: {
    ref: 'BL-101',
    bn: 'অ্যাকাউন্ট স্থগিত করা হয়েছে।',
    en: 'The account is suspended.',
  },
  INVALID_CREDENTIALS: {
    ref: 'BL-102',
    bn: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',
    en: 'The email or password is incorrect.',
  },
  OTP_INVALID: {
    ref: 'BL-103',
    bn: 'কোডটি সঠিক নয় বা মেয়াদ শেষ হয়েছে।',
    en: 'The code is invalid or expired.',
  },
  OTP_COOLDOWN: {
    ref: 'BL-104',
    bn: 'আবার কোড পাঠানোর আগে অপেক্ষা করুন।',
    en: 'Please wait before requesting another code.',
  },
  DONOR_UNDERAGE: {
    ref: 'BL-200',
    bn: 'দাতা হতে আপনার বয়স কমপক্ষে ১৮ বছর হতে হবে।',
    en: 'Donors must be at least 18 years old.',
  },
  REQUEST_NOT_FOUND: {
    ref: 'BL-300',
    bn: 'রক্তের অনুরোধটি পাওয়া যায়নি।',
    en: 'The blood request was not found.',
  },
  MONEY_POLICY: {
    ref: 'BL-301',
    bn: 'রক্তের বিনিময়ে টাকা চাওয়া যাবে না।',
    en: 'Money must never be requested in exchange for blood.',
  },
  USER_BUSY: {
    ref: 'BL-400',
    bn: 'ব্যবহারকারী বর্তমানে অন্য কলে আছেন।',
    en: 'The user is currently busy on another call.',
  },
} as const satisfies Record<string, ErrorDefinition>;
