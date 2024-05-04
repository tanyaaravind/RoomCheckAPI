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
                    let building = meeting.bldgDescr || 'Unavailable'
                    let room = meeting.facilityDescr || 'Unavailable'
                    
                    if (room !== 'Unavailable') {
                        let roomNumber = room.split(" ").pop()

                        if (!bldgData[building]) {
                            bldgData[building] = {}
                        }

                        if (!bldgData[building][roomNumber]) {
                            bldgData[building][roomNumber] = []
                        }

                        bldgData[building][roomNumber].push({
                            className: classes.subject + " " + classes.catalogNbr || 'Unavailable',
                            startTime: meeting.timeStart || 'Unavailable',
                            endTime: meeting.timeEnd || 'Unavailable',
                            startDate: meeting.startDt || 'Unavailable',
                            endDate: meeting.endDt || 'Unavailable',
                            pattern: meeting.pattern || 'Unavailable'
                        })
                    }

                })
            })
        })
    })
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