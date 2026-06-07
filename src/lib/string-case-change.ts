export const capitalizeFirstLetter = (input: string): string => {
    if (!input) return "";
    return input.charAt(0).toUpperCase() + input.slice(1);
};