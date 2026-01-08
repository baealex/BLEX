import { Toaster as SonnerToaster } from '@blex/ui';

const Toaster = () => {
    return (
        <SonnerToaster
            position="top-center"
            expand={false}
            richColors
            closeButton
            duration={3000}
        />
    );
};

export default Toaster;
