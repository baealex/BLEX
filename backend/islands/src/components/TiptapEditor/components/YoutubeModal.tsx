import React, { useState } from 'react';

interface YoutubeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (id: string) => void;
}

const YoutubeModal: React.FC<YoutubeModalProps> = ({ isOpen, onClose, onUpload }) => {
    const [youtubeId, setYoutubeId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (youtubeId) {
            onUpload(youtubeId);
            setYoutubeId('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md mx-4 p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">YouTube 영상 추가</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                        ×
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="youtube-id" className="block text-sm font-medium text-gray-700 mb-2">
                            YouTube 영상 ID 또는 URL
                        </label>
                        <input
                            id="youtube-id"
                            type="text"
                            value={youtubeId}
                            onChange={(e) => {
                                let id = e.target.value;
                                if (id.includes('youtube.com') || id.includes('youtu.be')) {
                                    const match = id.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                                    if (match && match[1]) {
                                        id = match[1];
                                    }
                                }
                                setYoutubeId(id);
                            }}
                            placeholder="dQw4w9WgXcQ 또는 https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!youtubeId}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            추가
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default YoutubeModal;