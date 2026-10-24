/**
 * 把秒数格式化为时长文本。
 *
 * 不足 1 小时用 `MM:SS`，超过用 `H:MM:SS`——答题时长绝大多数都在一小时以内，
 * 常态下少一段数字更好读。负数按 0 处理（时钟回拨等异常输入不应显示成负时长）。
 */
export function formatDuration(totalSeconds: number): string {
    const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    const pad = (value: number): string => String(value).padStart(2, "0");

    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(remainder)}` : `${pad(minutes)}:${pad(remainder)}`;
}
