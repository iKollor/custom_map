'use client';

import { forwardRef, useMemo, useState } from 'react';
import { ComponentProps } from 'react';
import { HexColorPicker } from 'react-colorful';
import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import { buttonVariants } from '@workspace/ui/components/button';
import { type VariantProps } from 'class-variance-authority';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@workspace/ui/components/popover';

interface ColorPickerProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
}
interface ButtonProps extends ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const ColorPicker = forwardRef<
    HTMLButtonElement,
    Omit<ButtonProps, 'value' | 'onChange' | 'onBlur'> & ColorPickerProps
>(
    (
        { disabled, value, onChange, onBlur, name, className, size, ...props },
        ref,
    ) => {
        const [open, setOpen] = useState(false);

        const parsedValue = useMemo(() => {
            return value || '#FFFFFF';
        }, [value]);

        return (
            <Popover onOpenChange={setOpen} open={open}>
                <PopoverTrigger asChild disabled={disabled} onBlur={onBlur}>
                    <Button
                        {...props}
                        ref={ref}
                        className={cn('block', className)}
                        name={name}
                        onClick={() => {
                            setOpen(true);
                        }}
                        size={size}
                        style={{
                            backgroundColor: parsedValue,
                        }}
                        variant='outline'
                    >
                        <div />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className='w-full'>
                    <HexColorPicker color={parsedValue} onChange={onChange} />
                </PopoverContent>
            </Popover>
        );
    }
);
ColorPicker.displayName = 'ColorPicker';

export { ColorPicker, HexColorPicker };