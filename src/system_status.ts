interface ISYSTEM_STATUS {
  ABORT: boolean;
  EXITSTATUS: number | null;
}

export const SYSTEM_STATUS: ISYSTEM_STATUS = {
  ABORT: false,
  EXITSTATUS: null,
};
