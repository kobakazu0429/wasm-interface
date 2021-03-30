export const IO: {
  stdout: (...args: any[]) => void;
  stderr: (...args: any[]) => void;
  stdin?: (input: string) => void;
} = {
  stdout: console.log,
  stderr: console.warn,
};
