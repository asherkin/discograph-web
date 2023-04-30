export default function Privacy() {
    return <div className="mx-auto mt-6 prose dark:prose-invert">
        <h2>Privacy Policy</h2>
        <p>
            DiscoGraph is a Discord Bot Application, this means that it is added to a Discord Server by an
            authorised user of that server, and then it will receive information about the server and the messages
            sent within it by other users.
        </p>
        <p>
            There is also this companion website, where users can login and see which of the servers they have
            joined that the bot is also present in, and perform actions related to the collected data.
        </p>

        <h4>Data We Routinely Store</h4>
        <p>
            This is the data we require to be able to provide DiscoGraph as a service.
        </p>
        <ul>
            <li>Unique numeric identifiers provided by Discord for users and servers.</li>
            <li>Historical relationship event changes (e.g. user X mentioned user Y in server Z).</li>
            <li>Cached metadata required to output relationship graphs (e.g. names, roles).</li>
            <li>Records of direct interactions with the bot (e.g. joining a new server, or a user requesting a graph image).</li>
        </ul>

        <h4>Data We May Store</h4>
        <p>
            This is data we may store when required, such as when troubleshooting an issue with the service. This
            data will only be collected and stored for as long as it is required.
        </p>
        <ul>
            <li>The full contents of events and responses provided by Discord.</li>
        </ul>

        <h3>Questions?</h3>
        <p>
            If you have any questions about how we store or use your data, please email us at <a href="mailto:privacy@discograph.gg">privacy@discograph.gg</a>.
        </p>
    </div>;
}
