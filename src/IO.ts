export const IO: {
  stdout: (...args: any[]) => void;
  stderr: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  stdin?: any;
} = {
  stdout: console.log,
  stderr: console.warn,
  debug: console.debug,
};
