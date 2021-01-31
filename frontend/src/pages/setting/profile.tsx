import React, { useState } from 'react';
import { toast } from 'react-toastify';

import SettingLayout from '@components/setting/layout';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

interface Props extends API.SettingProfileData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    const { data } = await API.getSetting(req.headers.cookie, 'profile');
    if(data === API.ERROR.NOT_LOGIN) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: data
    };
}

export default function Setting(props: Props) {
    const [ bio, setBio ] = useState(props.bio);
    const [ homepage, setHomepage ] = useState(props.homepage);
    const [ github, setGithub ] = useState(props.github);
    const [ twitter, setTwitter ] = useState(props.twitter);
    const [ facebook, setFacebook ] = useState(props.facebook);
    const [ instagram, setInstagram ] = useState(props.instagram);
    const [ youtube, setYoutube ] = useState(props.youtube);

    const onSubmit = async () => {
        let sendData: any = {};

        sendData['bio'] = bio;
        sendData['homepage'] = homepage;
        sendData['github'] = github;
        sendData['twitter'] = twitter;
        sendData['facebook'] = facebook;
        sendData['instagram'] = instagram;
        sendData['youtube'] = youtube;

        const { data } = await API.putSetting('profile', sendData);
        if(data == 'DONE') {
            toast('😀 프로필이 업데이트 되었습니다.');
        }
    };
    
    return (
        <>
            <SettingLayout tabname="profile">
                <textarea
                    cols={40}
                    rows={4}
                    placeholder="자신을 간단히 설명하세요."
                    className="form-control mb-3"
                    onChange={(e) => setBio(e.target.value)}
                    value={bio}
                />
                <label>Homepage : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://</span>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        maxLength={100}
                        value={homepage}
                        onChange={(e) => setHomepage(e.target.value)}
                    />
                </div>
                <label>GitHub : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://github.com/</span>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        maxLength={100}
                        value={github}
                        onChange={(e) => setGithub(e.target.value)}
                    />
                </div>
                <label>Twitter : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://twitter.com/</span>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        maxLength={100}
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value)}
                    />
                </div>
                <label>Facebook : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://facebook.com/</span>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        maxLength={100}
                        value={facebook}
                        onChange={(e) => setFacebook(e.target.value)}
                    />
                </div>
                <label>Instagram : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://instagram.com/</span>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        maxLength={100}
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                    />
                </div>
                <label>YouTube : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://youtube.com/channel/</span>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        maxLength={100}
                        value={youtube}
                        onChange={(e) => setYoutube(e.target.value)}
                    />
                </div>
                <button
                    type="button"
                    className="btn btn-block btn-dark"
                    onClick={() => onSubmit()}>프로필 변경</button>
            </SettingLayout>
        </>
    );
}