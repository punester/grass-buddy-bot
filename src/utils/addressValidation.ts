
interface ValidationResult {
  isValid: boolean;
  error: string;
}

/**
 * Validates an address string
 */
export const validateAddress = (address: string): ValidationResult => {
  // Check if address is empty
  if (!address.trim()) {
    return {
      isValid: false,
      error: 'Address is required'
    };
  }
  
  // Check minimum length (very basic validation)
  if (address.trim().length < 5) {
    return {
      isValid: false,
      error: 'Please enter a complete address'
    };
  }
  
  // Check if address contains street number and name (very basic check)
  const hasStreetNumber = /\d+/.test(address);
  const hasStreetName = /[a-zA-Z]+/.test(address);
  
  if (!hasStreetNumber || !hasStreetName) {
    return {
      isValid: false,
      error: 'Please include street number and name'
    };
  }
  
  // You could add more sophisticated validation here
  
  return {
    isValid: true,
    error: ''
  };
};
