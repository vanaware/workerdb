import { signal, } from "@preact/signals";

export const activeTab = signal("opfs",);

export const opfsLog = signal("",);
export const indexLog = signal("",);
export const paginationLog = signal("",);
export const swLog = signal("",);

export const addLog = (
  logSignal: { value: string },
  msg: string,
) => {
  logSignal.value += msg + "\n";
};

export const clearLog = (logSignal: { value: string },) => {
  logSignal.value = "";
};
