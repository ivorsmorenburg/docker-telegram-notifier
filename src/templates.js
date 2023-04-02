module.exports = {
    container_start: e =>
        `<b>${e.Actor.Attributes.name}</b>\n<b>Image:</b> ${e.Actor.Attributes.image}\n<b>&#9654;&#65039; Has been started</b>`,

    container_die: e =>
        `<b>${e.Actor.Attributes.name}</b>\n<b>Image:</b> ${e.Actor.Attributes.image}\n<b>&#128308; Has been stopped</b>\n<b>Exit Code:</b> ${e.Actor.Attributes.exitCode}`,

    'container_health_status: healthy': e =>
        `<b>${e.Actor.Attributes.name}</b>\n<b>Image:</b> ${e.Actor.Attributes.image}\n<b>&#9989; Healthy</b>`,

    'container_health_status: unhealthy': e =>
        `<b>${e.Actor.Attributes.name}</b>\n<b>Image:</b> ${e.Actor.Attributes.image}\n<b>\u26A0\uFE0F Unhealthy!</b>\n<b>Exit Code:</b> ${e.Actor.Attributes.exitCode}`,
};
