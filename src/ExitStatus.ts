export class ExitStatus {
  constructor(status: any) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status;
  }
  public name: string;
  public message: string;
  public status: any;
}
