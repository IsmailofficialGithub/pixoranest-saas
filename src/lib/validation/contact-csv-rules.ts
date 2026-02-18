import type { ValidationRule } from '@/lib/csv-parser';

export const contactCSVRules: ValidationRule[] = [
  {
    field: 'phone_number',
    required: true,
    type: 'phone',
    custom: (value) => {
      if (value && !value.startsWith('+')) {
        return 'Phone number must start with + and country code (e.g., +919876543210)';
      }
      return null;
    },
  },
  {
    field: 'name',
    required: false,
    type: 'string',
    custom: (value) => {
      if (value && value.length > 100) return 'Name must be less than 100 characters';
      return null;
    },
  },
  {
    field: 'email',
    required: false,
    type: 'email',
  },
  {
    field: 'company',
    required: false,
    type: 'string',
  },
  {
    field: 'location',
    required: false,
    type: 'string',
  },
];

export const contactCSVTemplate = [
  { name: 'phone_number', example: '+919876543210' },
  { name: 'name', example: 'John Doe' },
  { name: 'email', example: 'john@example.com' },
  { name: 'company', example: 'Acme Inc' },
  { name: 'location', example: 'Mumbai, India' },
];
