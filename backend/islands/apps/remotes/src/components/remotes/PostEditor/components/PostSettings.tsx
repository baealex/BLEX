interface PostSettingsProps {
    formData: {
        hide: boolean;
        notice: boolean;
        advertise: boolean;
    };
    onChange: (field: string, value: boolean) => void;
}

const PostSettings = ({ formData, onChange }: PostSettingsProps) => {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">설정</label>

            <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                        type="checkbox"
                        id="hide"
                        name="hide"
                        checked={formData.hide}
                        onChange={(e) => onChange('hide', e.target.checked)}
                        className="w-4 h-4 text-gray-800 border-gray-300 rounded focus:ring-gray-400 mt-0.5"
                    />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">비공개</div>
                        <div className="text-xs text-gray-500">본인만 볼 수 있습니다</div>
                    </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                        type="checkbox"
                        id="notice"
                        name="notice"
                        checked={formData.notice}
                        onChange={(e) => onChange('notice', e.target.checked)}
                        className="w-4 h-4 text-gray-800 border-gray-300 rounded focus:ring-gray-400 mt-0.5"
                    />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">공지사항</div>
                        <div className="text-xs text-gray-500">블로그 상단에 고정</div>
                    </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                        type="checkbox"
                        id="advertise"
                        name="advertise"
                        checked={formData.advertise}
                        onChange={(e) => onChange('advertise', e.target.checked)}
                        className="w-4 h-4 text-gray-800 border-gray-300 rounded focus:ring-gray-400 mt-0.5"
                    />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">광고 표시</div>
                        <div className="text-xs text-gray-500">포스트에 광고 표시</div>
                    </div>
                </label>
            </div>
        </div>
    );
};

export default PostSettings;
