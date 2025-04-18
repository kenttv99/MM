// types/index.ts
import { ChangeEvent, FocusEvent, ReactNode } from "react";
import { IconType } from "react-icons";

// From admin-profile/page.tsx
export interface AdminProfile {
  id: number;
  fio: string;
  email: string;
  avatar_url?: string;
}

// From dashboard/page.tsx
export interface User {
  id: number;
  fio: string;
  email: string;
}

// From profile/page.tsx
export interface UserData {
  id: number;
  fio: string;
  email: string;
  telegram: string;
  whatsapp: string;
  avatar_url?: string;
}

export interface FormState {
  fio: string;
  telegram: string;
  whatsapp: string;
  avatarPreview: string | null;
  email: string;
}

export interface ValidationErrors {
  fio?: string;
  telegram?: string;
  whatsapp?: string;
}

// From public/page.tsx
export interface FeatureCardProps {
  href: string;
  icon: IconType;
  title: string;
  description: string;
  ctaText: string;
}

// From components/PageTransitionWrapper.tsx
export interface PageTransitionWrapperProps {
  children: ReactNode;
  disableLoading?: boolean;
}

// From components/PartnerButton.tsx
export interface PartnerButtonProps {
  onClick?: () => void;
}

// From components/Registration.tsx
export interface FieldConfig {
  name: string;
  type: string;
  placeholder: string;
  icon: IconType;
  validate: (value: string) => string | null;
  required?: boolean;
}

export interface FormErrors {
  [key: string]: string | null;
}

export interface TouchedFields {
  [key: string]: boolean;
}

// From components/common/AuthModal.tsx
export interface ModalButtonProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  error?: string;
  success?: string;
  children: ReactNode;
  className?: string;
  preventClose?: boolean;
}

// From components/common/ErrorDisplay.tsx
export interface ErrorDisplayProps {
  error: string | null;
  className?: string;
}

// From components/common/InputField.tsx
export interface InputFieldProps {
  type: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  icon: IconType;
  required?: boolean;
  name?: string;
  disabled?: boolean;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  className?: string;
}

// From components/common/SuccessDisplay.tsx
export interface SuccessDisplayProps {
  message: string | null;
  className?: string;
}

// From components/Errors/ErrorBoundary.tsx
export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
}

// From hooks/useAdminAuthForm.ts
export interface AdminFormValues {
  email: string;
  password: string;
  [key: string]: string;
}

export interface AdminAuthFormOptions {
  initialValues: AdminFormValues;
  endpoint: string;
  redirectTo: string;
}

// From hooks/useAuthForm.tsx
export type AuthFormValues = Record<string, string>;

export interface UseAuthFormProps {
  initialValues: AuthFormValues;
  endpoint: string;
  onSuccess?: () => void;
  isLogin?: boolean;
}

// From hooks/useChangePasswordForm.ts
export interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordFormOptions {
  initialValues: ChangePasswordFormValues;
  onSuccess?: () => void;
}

// From components/ChangePasswordForm.tsx
export interface ChangePasswordFormProps {
  isOpen: boolean;
  onClose: () => void;
}

// From components/EventDetails.tsx
export interface EventDetailsProps {
  date: string;
  time: string;
  location: string;
  price: number;
  freeRegistration: boolean;
}

// From components/EventRegistration.tsx
export interface EventRegistrationProps {
  eventId: number;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  ticketType: string;
  availableQuantity: number;
  soldQuantity: number;
  price: number;
  freeRegistration: boolean;
  onBookingClick: () => void;
  onLoginClick: () => void;
  onBookingSuccess?: () => void;
  onReady?: () => void;
  displayStatus?: string;
}

// From components/FormattedDescription.tsx
export interface FormattedDescriptionProps {
  content: string;
  className?: string;
}

// From components/Header.tsx
export interface NavItem {
  href?: string;
  label: string;
  onClick?: () => void;
}

// From components/Login.tsx
export interface LoginProps {
  isOpen: boolean;
  onClose: () => void;
  toggleMode?: () => void;
  isAdminLogin?: boolean;
  preventClose?: boolean;
}