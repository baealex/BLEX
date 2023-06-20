import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { Accordion, Button, Card, Text } from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';

import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { useForm } from '~/hooks/use-form';

type Props = API.GetSettingIntegrationOpenAIResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
    const { data } = await API.getSettingIntegrationOpenAI({ 'Cookie': req.headers.cookie || '' });

    if (data.status === 'ERROR') {
        return {
            redirect: {
                destination: '/',
                permanent: false
            }
        };
    }
    return { props: data.body };
};

type Form = API.PostSettingIntegrationTelegramResponseData;

const SettingIntegrationTelegram: PageComponent<Props> = (props: Props) => {
    const router = useRouter();

    const {
        register,
        handleSubmit: handleSubmitWrapper
    } = useForm<Form>();

    const handleSubmit = handleSubmitWrapper(async (data) => {
        const { data: response } = await API.postSettingIntegrationOpenAI(data);

        if (response.status === 'ERROR') {
            snackBar(message('AFTER_REQ_ERR', response.errorMessage));
            return;
        }

        router.reload();
    });

    const handleDelete = async () => {
        const { data: response } = await API.deleteSettingIntegrationOpenAI();

        if (response.status === 'ERROR') {
            snackBar(message('AFTER_REQ_ERR', response.errorMessage));
            return;
        }

        router.reload();
    };

    return (
        <>
            <Card className="p-3" isRounded hasBackground>
                <div style={{ lineHeight: '1.75' }}>
                    <div>
                        <b>Open AI와 연동하면 어떤 효과가 있나요?</b>
                    </div>
                    <ul className="mb-3">
                        <li>글 작성시 설명을 효과적으로 요약할 수 있습니다.</li>
                    </ul>
                    {!props.isConnected && (
                        <div className="mb-3">
                            <b>어떻게 연동하나요?</b>
                            <ul>
                                <li>
                                    OpenAI API를 기반으로 동작하므로 API key가 필요합니다.
                                    첨부된 링크에서 API key를 발급받아 등록할 수 있습니다.{' '}
                                    <a href="https://platform.openai.com/account/api-keys" target="_blank">
                                        openai.com/account/api-keys
                                    </a>
                                </li>
                            </ul>
                        </div>
                    )}
                    등록된 API key는 서버에 저장되며 사용자 본인의 글에만 사용될 것입니다.
                    해당 값은 서비스에서 남용하지 않는 것을 전제하나 완벽히 보장될 수 없으므로
                    사용자 본인의 책임 하에 사용해야 합니다.
                    서비스에서 사용한 내역은 로그로 남기며 현재 페이지에서 확인하실 수 있습니다.
                </div>
            </Card>
            {!props.isConnected && (
                <form className="input-group mt-3" onSubmit={handleSubmit}>
                    <div className="input-group-prepend">
                        <span className="input-group-text">API KEY</span>
                    </div>
                    <input
                        {...register('api_key')}
                        type="text"
                        className="form-control"
                        maxLength={100}
                    />
                    <div className="input-group-prepend">
                        <Button type="submit">
                            등록
                        </Button>
                    </div>
                </form>
            )}
            {props.isConnected && (
                <>
                    <Card className="mt-3 p-3" isRounded hasBackground>
                        <div className="d-flex align-items-center justify-content-between flex-wrap">
                            <div>
                                <div className="flex items-center">
                                    <i className="fas fa-microchip text-2xl mr-2" />
                                    <Text tag="span" fontWeight={600}>등록된 API KEY</Text>
                                </div>
                                <div className="mt-2">
                                    <span className="text-lg">{props.apiKey}</span>
                                </div>
                            </div>
                        </div>
                        <Button
                            display="block"
                            className="mt-3"
                            onClick={handleDelete}>
                            등록 해제
                        </Button>
                    </Card>
                    {props.usageHistories.map((history) => (
                        <Card className="mt-3 p-3" isRounded>
                            <div className="d-flex align-items-center justify-content-between flex-wrap">
                                <div>
                                    <div className="flex items-center">
                                        <i className="fas fa-history text-2xl mr-2" />
                                        <Text tag="span" fontWeight={600}>사용 내역</Text>
                                    </div>
                                    <div className="mt-2">
                                        <Accordion minHeight={24}>{JSON.stringify(history)}</Accordion>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </>
            )}
        </>
    );
};

SettingIntegrationTelegram.pageLayout = (page) => (
    <SettingLayout active="integration/open-ai">
        {page}
    </SettingLayout>
);

export default SettingIntegrationTelegram;
