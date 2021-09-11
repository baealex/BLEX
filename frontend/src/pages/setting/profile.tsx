import { GetServerSidePropsContext } from 'next';
import React, { useState } from 'react';
import { toast } from 'react-toastify';

import { Alert, Button, Text } from '@components/integrated';
import { Layout } from '@components/setting';
import { ImageInput } from '@components/integrated';

import * as API from '@modules/api';

import { loadingContext } from '@state/loading'

interface Props extends API.GetSettingProfileData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const { data } = await API.getSettingProfile(req.headers.cookie);
    if(data.status === 'ERROR') {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: data.body
    };
}

export default function ProfileSetting(props: Props) {
    const [ avatar, setAvatar ] = useState(props.avatar);
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
        if(data.status === 'DONE') {
            toast('😀 프로필이 업데이트 되었습니다.');
        }
    };
    
    return (
        <>
            <div className="mb-5">
                <div className="mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 이미지
                    </Text>
                </div>
                <ImageInput
                    url={avatar}
                    label="이미지 변경"
                    onChange={async (file) => {
                        loadingContext.setState({
                            isLoading: true,
                        })
                        const formData = new FormData();
                        formData.append('avatar', file);
                        const { data } = await API.postSettingAvatar(formData);
                        setAvatar(data.body.url);
                        loadingContext.setState({
                            isLoading: false,
                        })
                    }}
                />
            </div>
            <div className="mb-5">
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 소개
                    </Text>
                    <Button onClick={() => onSubmit()}>
                        업데이트
                    </Button>
                </div>
                <div className="mb-2">
                    <Alert type="warning">
                        포스트 상단에서 작성자를 소개하는 문장입니다.
                        자신을 한문장으로 표현해 본다면?
                    </Alert>
                </div>
                <textarea
                    cols={40}
                    rows={4}
                    placeholder="자신을 간단히 설명하세요."
                    className="form-control mb-3"
                    onChange={(e) => setBio(e.target.value)}
                    value={bio}
                />
            </div>
            <div className="mb-5">
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        소셜 정보
                    </Text>
                    <Button onClick={() => onSubmit()}>
                        업데이트
                    </Button>
                </div>
                <label>개인 홈페이지 주소 : </label>
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
                <label>깃허브 주소 : </label>
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
                <label>트위터 주소 : </label>
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
                <label>페이스북 주소 : </label>
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
                <label>인스타그램 주소 : </label>
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
                <label>유튜브 채널 주소 : </label>
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
            </div>
        </>
    );
}

ProfileSetting.pageLayout = (page: JSX.Element) => (
    <Layout tabname="profile">
        {page}
    </Layout>
)