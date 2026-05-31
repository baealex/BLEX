import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Modal } from '@blex/ui/modal';
import { cx } from '~/lib/classnames';

interface ImageCropDialogProps {
    isOpen: boolean;
    file: File | null;
    title: string;
    aspectRatio: number;
    outputWidth: number;
    outputHeight: number;
    onClose: () => void;
    onComplete: (file: File) => void | Promise<void>;
}

const MAX_ZOOM = 3;
const MIN_ZOOM = 1;
const JPEG_QUALITY = 0.92;

const extensionByType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
};

const getOutputType = (fileType: string) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(fileType)) {
        return fileType;
    }
    return 'image/jpeg';
};

const getCroppedFileName = (name: string, outputType: string) => {
    const baseName = name.replace(/\.[^.]+$/, '') || 'image';
    const extension = extensionByType[outputType] ?? 'jpg';
    return `${baseName}-cropped.${extension}`;
};

const createImage = async (sourceUrl: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = sourceUrl;
});

const createCroppedFile = async ({
    sourceUrl,
    cropArea,
    file,
    outputWidth,
    outputHeight
}: {
    sourceUrl: string;
    cropArea: Area;
    file: File;
    outputWidth: number;
    outputHeight: number;
}) => {
    const image = await createImage(sourceUrl);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Canvas context is not available.');
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    context.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        outputWidth,
        outputHeight
    );

    const outputType = getOutputType(file.type);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
            if (nextBlob) {
                resolve(nextBlob);
                return;
            }
            reject(new Error('Failed to create cropped image.'));
        }, outputType, JPEG_QUALITY);
    });

    return new File([blob], getCroppedFileName(file.name, outputType), {
        type: outputType,
        lastModified: Date.now()
    });
};

export const ImageCropDialog = ({
    isOpen,
    file,
    title,
    aspectRatio,
    outputWidth,
    outputHeight,
    onClose,
    onComplete
}: ImageCropDialogProps) => {
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const [crop, setCrop] = useState<Point>({
        x: 0,
        y: 0
    });
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [cropArea, setCropArea] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!isOpen || !file) {
            setSourceUrl(null);
            return undefined;
        }

        const nextSourceUrl = URL.createObjectURL(file);
        setSourceUrl(nextSourceUrl);
        setCrop({
            x: 0,
            y: 0
        });
        setZoom(MIN_ZOOM);
        setCropArea(null);
        setErrorMessage('');

        return () => URL.revokeObjectURL(nextSourceUrl);
    }, [file, isOpen]);

    const handleZoomChange = (event: ChangeEvent<HTMLInputElement>) => {
        setZoom(Number(event.target.value));
    };

    const handleApply = async () => {
        if (!file || !sourceUrl || !cropArea) return;

        setIsProcessing(true);
        setErrorMessage('');

        try {
            const croppedFile = await createCroppedFile({
                sourceUrl,
                cropArea,
                file,
                outputWidth,
                outputHeight
            });
            await onComplete(croppedFile);
            onClose();
        } catch {
            setErrorMessage('이미지를 적용하지 못했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        if (!isProcessing) {
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={title}
            maxWidth="3xl">
            <Modal.Body className="space-y-5">
                <div
                    className={cx(
                        'relative mx-auto w-full overflow-hidden bg-line-light ring-1 ring-line',
                        'max-w-2xl rounded-2xl'
                    )}
                    style={{ aspectRatio }}>
                    {sourceUrl && (
                        <Cropper
                            image={sourceUrl}
                            crop={crop}
                            zoom={zoom}
                            minZoom={MIN_ZOOM}
                            maxZoom={MAX_ZOOM}
                            aspect={aspectRatio}
                            cropShape="rect"
                            showGrid
                            onCropChange={setCrop}
                            onCropComplete={(_, croppedAreaPixels) => setCropArea(croppedAreaPixels)}
                            onZoomChange={setZoom}
                            classes={{ cropAreaClassName: 'ring-content-inverted/80' }}
                        />
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold text-content-secondary">
                        <label htmlFor="image-crop-zoom">확대</label>
                        <span>{Math.round(zoom * 100)}%</span>
                    </div>
                    <input
                        id="image-crop-zoom"
                        type="range"
                        min={MIN_ZOOM}
                        max={MAX_ZOOM}
                        step={0.01}
                        value={zoom}
                        onChange={handleZoomChange}
                        disabled={isProcessing}
                        className="w-full accent-action"
                    />
                </div>

                {errorMessage && (
                    <p className="text-sm font-medium text-danger">{errorMessage}</p>
                )}
            </Modal.Body>

            <Modal.Footer>
                <Modal.FooterAction
                    variant="secondary"
                    onClick={handleClose}
                    disabled={isProcessing}>
                    취소
                </Modal.FooterAction>
                <Modal.FooterAction
                    onClick={handleApply}
                    isLoading={isProcessing}
                    disabled={!sourceUrl || !cropArea}>
                    적용
                </Modal.FooterAction>
            </Modal.Footer>
        </Modal>
    );
};
