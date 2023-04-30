import ErrorComponent from "./_error";

// This lets our 404 page be a static page even with our custom _error handler.
export default function FourOhFour() {
    return <ErrorComponent statusCode={404} />;
}
