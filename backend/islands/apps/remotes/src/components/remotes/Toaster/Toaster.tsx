import { Toaster as SonnerToaster } from '@blex/ui/toast';

const Toaster = () => {
    return (
        <SonnerToaster
            position="top-center"
            expand={false}
            richColors
            closeButton
        />
    );
};

export default Toaster;
