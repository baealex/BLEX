import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface ProfileFormProps {
    avatar: string;
    bio: string;
    homepage: string;
}

const ProfileForm = ({ avatar: initialAvatar, bio: initialBio, homepage: initialHomepage }: ProfileFormProps) => {
    const [avatar, setAvatar] = useState(initialAvatar);
    const [bio, setBio] = useState(initialBio);
    const [homepage, setHomepage] = useState(initialHomepage);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('bio', bio);
            formData.append('homepage', homepage);

            const { data } = await http('v1/setting/profile', {
                method: 'PUT',
                data: formData
            });

            if (data.status === 'DONE') {
                notification('프로필이 업데이트 되었습니다.', { type: 'success' });
            } else {
                notification('프로필 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('프로필 업데이트에 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const { data } = await http('v1/setting/avatar', {
                method: 'PUT',
                data: formData
            });

            if (data.status === 'DONE') {
                setAvatar(data.body.avatar);
                notification('프로필 이미지가 업데이트 되었습니다.', { type: 'success' });
            } else {
                notification('프로필 이미지 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('프로필 이미지 업데이트에 실패했습니다.', { type: 'error' });
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">프로필 이미지</label>
                    <div className="avatar-container">
                        <img
                            src={avatar}
                            alt="프로필 이미지"
                            className="avatar-preview"
                        />
                        <div className="avatar-upload">
                            <label htmlFor="avatar-input" className="avatar-upload-label">
                                <i className="fas fa-camera" />
                            </label>
                            <input
                                id="avatar-input"
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="avatar-input"
                            />
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="bio" className="form-label">소개</label>
                    <textarea
                        id="bio"
                        className="form-control"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        placeholder="자신을 소개해 보세요"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="homepage" className="form-label">홈페이지</label>
                    <input
                        id="homepage"
                        type="url"
                        className="form-control"
                        value={homepage}
                        onChange={(e) => setHomepage(e.target.value)}
                        placeholder="https://"
                    />
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}>{isLoading ? '저장 중...' : '저장'}</button>
            </form>

            <style jsx>{`
                .avatar-container {
                    position: relative;
                    width: 100px;
                    height: 100px;
                    margin-bottom: 20px;
                }

                .avatar-preview {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .avatar-upload {
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    background-color: #4568dc;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }

                .avatar-upload-label {
                    color: white;
                    cursor: pointer;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .avatar-input {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default ProfileForm;
