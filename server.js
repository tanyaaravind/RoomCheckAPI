const express = require('express')
const axios = require('axios')
const app = express()

const year = "SP24"
let subjectList = []


axios.get(`https://classes.cornell.edu/api/2.0/config/subjects.json?roster=${year}`)
    .then(response => {
        if (!response.data || !response.data.data || !response.data.data.subjects) {
            throw new Error('Failed to fetch subjects')
        }
        subjectList = response.data.data.subjects.map(subject => subject.value)
    })
    .catch(error => {
        console.error('There was a problem fetching subjects:', error)
    })

async function fetchClassData(subject) {
    try {
        const response = await axios.get(`https://classes.cornell.edu/api/2.0/search/classes.json?roster=${year}&subject=${subject}`)
        return response.data.data.classes
    } catch (error) {
        console.error(`Error fetching ${subject} class data:`, error)
        throw error
    }
}

async function fetchTimings() {
    const bldgData = {}
    for (const subject of subjectList) {
        try {
            const classData = await fetchClassData(subject)
            formatData(bldgData, classData)
        } catch (error) {
            console.error(`Error fetching and organizing data for ${subject} classes:`, error)
        }
    }
    return bldgData
}

function formatData(bldgData, classData) {
    classData.forEach(classes => {
        classes.enrollGroups.forEach(group => {
            group.classSections.forEach(section => {
                section.meetings.forEach(meeting => {
                    let building = meeting.bldgDescr || 'Unavailable';
                    let room = meeting.facilityDescr || 'Unavailable';

                    if (room !== 'Unavailable') {
                        let roomNumber = room.split(" ").pop();

                        if (!bldgData[building]) {
                            bldgData[building] = {};
                        }

                        if (!bldgData[building][roomNumber]) {
                            bldgData[building][roomNumber] = [];
                        }


                        // Convert time from AM/PM to 24-hour clock format
                        let startTime = meeting.timeStart.split(':');
                        let startHour = parseInt(startTime[0]);
                        let startMinute = parseInt(startTime[1].substr(0, 2));
                        if (startTime[1].substr(2, 2) === 'PM' && startHour !== 12) {
                            startHour += 12;
                        } else if (startTime[1].substr(2, 2) === 'AM' && startHour === 12) {
                            startHour = 0;
                        }

                        let endTime = meeting.timeEnd.split(':');
                        let endHour = parseInt(endTime[0]);
                        let endMinute = parseInt(endTime[1].substr(0, 2));
                        if (endTime[1].substr(2, 2) === 'PM' && endHour !== 12) {
                            endHour += 12;
                        } else if (endTime[1].substr(2, 2) === 'AM' && endHour === 12) {
                            endHour = 0;
                        }

                        // Format the time in 24-hour clock format as HH:mm
                        let formattedStartTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
                        let formattedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

                        bldgData[building][roomNumber].push({
                            className: classes.subject + " " + classes.catalogNbr || 'Unavailable',
                            startTime: formattedStartTime || 'Unavailable',
                            endTime: formattedEndTime || 'Unavailable',
                            startDate: meeting.startDt || 'Unavailable',
                            endDate: meeting.endDt || 'Unavailable',
                            pattern: meeting.pattern || 'Unavailable'
                        });
                    }

                });
            });
        });
    });
}

function convertTo24HourFormat(timeString) {
    let [time, period] = timeString.split(" "); // Split time and AM/PM
    let [hours, minutes] = time.split(":"); // Split hours and minutes

    hours = parseInt(hours); // Parse hours as integer

    // If the period is PM and the hours are less than 12, add 12 to convert to 24-hour format
    if (period === "PM" && hours < 12) {
        hours += 12;
    }

    // If the period is AM and the hours are 12, set hours to 0 (midnight)
    if (period === "AM" && hours === 12) {
        hours = 0;
    }

    // Return the time in 24-hour clock format as HH:mm
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
}


app.get('/', async (req, res) => {
    try {
        const bldgData = await fetchTimings()
        res.json(bldgData)
    } catch (error) {
        console.error('Error fetching and organizing data for all buildings:', error)
        res.status(500).json({ error: 'Failed to fetch and organize data for all buildings' })
    }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`)
})