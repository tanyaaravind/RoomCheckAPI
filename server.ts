import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();

const year: string = "SP24";
let subjectList: string[] = [];

axios.get(`https://classes.cornell.edu/api/2.0/config/subjects.json?roster=${year}`)
    .then(response => {
        if (!response.data || !response.data.data || !response.data.data.subjects) {
            throw new Error('Failed to fetch subjects');
        }
        subjectList = response.data.data.subjects.map((subject: { value: string }) => subject.value);
    })
    .catch(error => {
        console.error('There was a problem fetching subjects:', error);
    });

interface Meeting {
    className?: string;
    bldgDescr?: string;
    facilityDescr?: string;
    startTime?: string;
    endTime?: string;
    startDt?: string;
    endDt?: string;
    pattern?: string;
}

async function fetchClassData(subject: string): Promise<any[]> {
    try {
        const response = await axios.get(`https://classes.cornell.edu/api/2.0/search/classes.json?roster=${year}&subject=${subject}`);
        return response.data.data.classes;
    } catch (error) {
        console.error(`Error fetching ${subject} class data:`, error);
        throw error;
    }
}

async function fetchTimings(): Promise<any> {
    const bldgData: { [key: string]: { [key: string]: Meeting[] } } = {};
    for (const subject of subjectList) {
        try {
            const classData = await fetchClassData(subject);
            formatData(bldgData, classData);
        } catch (error) {
            console.error(`Error fetching and organizing data for ${subject} classes:`, error);
        }
    }
    return bldgData;
}

function formatData(bldgData: { [key: string]: { [key: string]: Meeting[] } }, classData: any[]): void {
    classData.forEach((classes: any) => {
        classes.enrollGroups.forEach((group: any) => {
            group.classSections.forEach((section: any) => {
                section.meetings.forEach((meeting: Meeting) => {
                    let building: string = meeting.bldgDescr || 'Unavailable';
                    let room: string = meeting.facilityDescr || 'Unavailable';
                    
                    if (room !== 'Unavailable') {
                        let roomNumber: string = room.split(" ").pop() || 'Unavailable';

                        if (!bldgData[building]) {
                            bldgData[building] = {};
                        }

                        if (!bldgData[building][roomNumber]) {
                            bldgData[building][roomNumber] = [];
                        }

                        

                        bldgData[building][roomNumber].push({
                            className: classes.subject + " " + classes.catalogNbr || 'Unavailable',
                            startTime: meeting.startTime || 'Unavailable',
                            endTime: meeting.endTime || 'Unavailable',
                            startDt: meeting.startDt || 'Unavailable',
                            endDt: meeting.endDt || 'Unavailable',
                            pattern: meeting.pattern || 'Unavailable'
                        });
                    }
                });
            });
        });
    });
}

app.get('/', async (req: Request, res: Response) => {
    try {
        const bldgData = await fetchTimings();
        res.json(bldgData);
    } catch (error) {
        console.error('Error fetching and organizing data for all buildings:', error);
        res.status(500).json({ error: 'Failed to fetch and organize data for all buildings' });
    }
});

const PORT: number | string = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});