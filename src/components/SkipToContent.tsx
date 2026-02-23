const SkipToContent = () => {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-6 focus:py-3 focus:bg-primary focus:text-black focus:font-display focus:font-bold focus:uppercase focus:tracking-widest"
        >
            Skip to content
        </a>
    );
};

export default SkipToContent;
